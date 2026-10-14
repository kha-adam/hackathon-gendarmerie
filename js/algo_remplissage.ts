import * as turf from '@turf/turf';
import { Feature, Polygon, Point, MultiPolygon } from 'geojson';

// Définition des paramètres d'entrée
export interface CircleDef {
    radius: number;   // Rayon en kilomètres (ou degrés selon la projection Turf)
    area: number;     // Aire théorique d'un cercle (précalculée)
}

export interface Solution {
    centers: Feature<Point>[];
    radii: number[];
    coveragePercentage: number;
}

export class CoverageOptimizer {
    private bestSolution: Solution = { centers: [], radii: [], coveragePercentage: 0 };
    private polygonArea: number;
    private nbTeleop: number[]; // Nb teleop de niveau 1 et 2 dispos
    
    // Variables pour la gestion du temps et de l'élagage
    private startTime: number = 0;
    private timeLimitMs: number = 0;
    private timeLimitReached: boolean = false;
    private objCoverage: number = 100;
    
    // Couverture maximale théorique (0 chevauchement, 0 perte)
    private maxTheoreticalPercentage: number = 0;

    constructor(
        private polygon: Feature<Polygon>,
        private grid: Feature<Point>[],
        private circle1: CircleDef,
        private circle2: CircleDef,
        nbTeleop: number[]
    ) {
        if (nbTeleop.length != 2 || !Number.isInteger(nbTeleop[0]) || !Number.isInteger(nbTeleop[1])) {
            throw new Error("Nombre d'éléments de la liste des teleop invalide, 2 entiers positifs sont attendus");
        }

        this.nbTeleop = nbTeleop;
        this.polygonArea = turf.area(this.polygon);
        
        // Précalcul de l'aire théorique des cercles
        const dummyPoint = turf.point([0, 0]);
        this.circle1.area = turf.area(turf.circle(dummyPoint, this.circle1.radius));
        this.circle2.area = turf.area(turf.circle(dummyPoint, this.circle2.radius));

        // Calcul de la limite théorique absolue (100% d'efficacité des cercles disponibles)
        const totalAvailableArea = (this.nbTeleop[0] * this.circle1.area) + (this.nbTeleop[1] * this.circle2.area);
        this.maxTheoreticalPercentage = (totalAvailableArea / this.polygonArea) * 100;
    }

    // Fonction de calcul du pourcentage de surface couverte via Turf.js
    private calculateCoveragePercentage(centers: Feature<Point>[], radii: number[]): number {
        if (centers.length === 0) return 0;

        const circles = centers.map((center, index) => 
            turf.circle(center, radii[index])
        );
        
        let unionPolygon: Feature<Polygon | MultiPolygon> = circles[0];
        for (let i = 1; i < circles.length; i++) {
            const unionResult = turf.union(turf.featureCollection([unionPolygon, circles[i]]));
            if (unionResult) {
               unionPolygon = unionResult as Feature<Polygon | MultiPolygon>;
            }
        }

        const intersection = turf.intersect(turf.featureCollection([unionPolygon, this.polygon]));
        const rawArea = intersection ? turf.area(intersection) : 0;
        return (rawArea / this.polygonArea) * 100;
    }

    public optimize(timeLimitSeconds: number = 0, objCoverage: number = 100): Solution {
        this.startTime = Date.now();
        this.timeLimitMs = timeLimitSeconds * 1000;
        this.timeLimitReached = false;
        this.objCoverage = objCoverage;
        
        this.explore(0, [], [], this.nbTeleop[0], this.nbTeleop[1], 0);
        
        if (this.timeLimitReached) {
            console.log(`Exploration interrompue : limite de temps de ${timeLimitSeconds}s atteinte.`);
        }
        
        return this.bestSolution;
    }

    private explore(
        gridIndex: number,
        currentCenters: Feature<Point>[],
        currentRadii: number[],
        remTeleopN1: number,
        remTeleopN2: number,
        currentPercentage: number
    ): void {
        // --- ARRÊT GLOBAL SI SOLUTION PARFAITE ATTEINTE ---
        // Si on a déjà trouvé un placement qui égale l'aire de tous les cercles dispos (aux erreurs de flottants près),
        // c'est mathématiquement impossible de faire mieux. On arrête tout.
        if (this.bestSolution.coveragePercentage >= this.maxTheoreticalPercentage - 0.0001) {
            return;
        }

        // --- GESTION DU TEMPS ---
        if (this.timeLimitMs > 0 && (Date.now() - this.startTime) >= this.timeLimitMs) {
            this.timeLimitReached = true;
            return;
        }
        
        if (this.timeLimitReached) return;

        // Condition d'arrêt : fin de grille ou plus de cercles
        if (gridIndex === this.grid.length || (remTeleopN1 === 0 && remTeleopN2 === 0)) {
            if (currentPercentage > this.bestSolution.coveragePercentage) {
                this.bestSolution = {
                    centers: [...currentCenters],
                    radii: [...currentRadii],
                    coveragePercentage: currentPercentage
                };
            }
            return;
        }

        // --- ÉLAGAGE (Branch and Bound) ---
        const maxPotentialExtraArea = (remTeleopN1 * this.circle1.area) + (remTeleopN2 * this.circle2.area);
        const maxPotentialExtraPercentage = (maxPotentialExtraArea / this.polygonArea) * 100;
        
        if (currentPercentage + maxPotentialExtraPercentage <= this.bestSolution.coveragePercentage) {
            return; 
        }

        // --- CONDITION D'OBJECTIF ---
        if (currentPercentage >= this.objCoverage) {
            this.bestSolution = { 
                centers: [...currentCenters], 
                radii: [...currentRadii], 
                coveragePercentage: currentPercentage 
            };
            return;
        }

        const point = this.grid[gridIndex];

        // --- CHOIX A : Placer un teleoperateur de niveau 2 ---
        if (remTeleopN2 > 0) {
            currentCenters.push(point);
            currentRadii.push(this.circle2.radius);
            
            const newPctC2 = this.calculateCoveragePercentage(currentCenters, currentRadii);
            this.explore(gridIndex + 1, currentCenters, currentRadii, remTeleopN1, remTeleopN2 - 1, newPctC2);
            
            currentCenters.pop();
            currentRadii.pop();
        }
        
        // --- CHOIX B : Placer un teleoperateur de niveau 1 ---
        if (remTeleopN1 > 0) {
            currentCenters.push(point);
            currentRadii.push(this.circle1.radius);
            
            const newPctC1 = this.calculateCoveragePercentage(currentCenters, currentRadii);
            this.explore(gridIndex + 1, currentCenters, currentRadii, remTeleopN1 - 1, remTeleopN2, newPctC1);
            
            currentCenters.pop();
            currentRadii.pop();
        }

        // --- CHOIX C : Ne rien placer ---
        this.explore(gridIndex + 1, currentCenters, currentRadii, remTeleopN1, remTeleopN2, currentPercentage);
    }
}