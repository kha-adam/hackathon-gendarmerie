import * as turf from '@turf/turf';
import { Feature, Polygon, Point } from 'geojson';
import { CoverageOptimizer, CircleDef, Solution } from './algo_remplissage'; // À adapter selon votre nom de fichier

export interface EstimationResult {
    totalTeleops: number;
    teleopN1: number;
    teleopN2: number;
    solution: Solution;
}

export class TeleopEstimator {
    // Constante : 20% des téléopérateurs sont de niveau 2
    private readonly RATIO_N2 = 0.2;
    // Constante: pourcentage du min de teleops necessaires 
    private readonly MIN_TO_MAX_RATIO_TELEOP = 0.5;

    constructor(
        private polygon: Feature<Polygon>,
        private grid: Feature<Point>[],
        private circle1: CircleDef,
        private circle2: CircleDef
    ) {
        // Précalcul des aires théoriques pour évaluer le point de départ
        const dummyPoint = turf.point([0, 0]);
        this.circle1.area = turf.area(turf.circle(dummyPoint, this.circle1.radius));
        this.circle2.area = turf.area(turf.circle(dummyPoint, this.circle2.radius));

    }

    /**
     * Cherche le nombre minimal de téléopérateurs pour atteindre la couverture visée.
     * @param objCoverage Pourcentage cible (ex: 30)
     * @param optimizerTimeLimitSeconds Temps maximum alloué pour UNE recherche
     */
    public estimateMinTeleops(objCoverage: number, optimizerTimeLimitSeconds: number = 20): EstimationResult | null {
        const polygonArea = turf.area(this.polygon);
        
        // 1. Calcul de la valeur de départ (hypothèse de couverture idéale sans superposition)
        const targetArea = polygonArea * (objCoverage / 100);
        const averageAreaPerTeleop = ((1 - this.RATIO_N2) * this.circle1.area) + (this.RATIO_N2 * this.circle2.area);
        
        // On arrondit à l'entier supérieur pour le nombre de départ, avec un minimum de 1
        let totalTeleops = Math.max(1, Math.ceil(targetArea / averageAreaPerTeleop));
        let nbMaxExec = Math.round(totalTeleops * this.MIN_TO_MAX_RATIO_TELEOP);
        
        let bestGlobalResult: EstimationResult | null = null;
        
        // 2. Boucle d'escalade : on ajoute 1 téléopérateur à chaque échec
        while (totalTeleops <= this.grid.length) {

            // Répartition selon la règle des 20%
            const nbN2 = Math.round(totalTeleops * this.RATIO_N2);
            const nbN1 = totalTeleops - nbN2;
            const nbTeleop = [nbN1, nbN2];

            console.log(`Test avec ${totalTeleops} téléopérateurs (${nbN1} de Niv1, ${nbN2} de Niv2)...`);

            // Instanciation de l'optimiseur pour cette tentative
            const optimizer = new CoverageOptimizer(
                this.polygon,
                this.grid,
                this.circle1,
                this.circle2,
                nbTeleop
            );

            const solution = optimizer.optimize(optimizerTimeLimitSeconds, objCoverage);

            bestGlobalResult = {
                totalTeleops,
                teleopN1: nbN1,
                teleopN2: nbN2,
                solution
            };

            // 3. Vérification du succès
            // On accorde une tolérance d'arrondi de virgule flottante pour l'égalité (ex: 29.99999)
            if (solution.coveragePercentage >= (objCoverage - 0.0001)) {
                console.log(`Objectif de ${objCoverage}% atteint (Score: ${solution.coveragePercentage.toFixed(2)}%) avec ${totalTeleops} opérateurs.`);
                return bestGlobalResult;
            }

            totalTeleops++; // Si l'objectif n'est pas atteint, on augmente les ressources de 1
        }

        console.log("Impossible d'atteindre l'objectif. Grille épuisée ou temps limite atteint.");
        return bestGlobalResult;
    }
}