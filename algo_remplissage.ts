import * as turf from '@turf/turf';
import { Feature, Polygon, Point, MultiPolygon } from 'geojson';

// Définition des paramètres d'entrée
interface CircleDef {
    radius: number;   // Rayon en kilomètres (ou degrés selon la projection Turf)
    area: number;     // Aire théorique d'un cercle (précalculée)
}

interface Solution {
    centers: Feature<Point>[];
    radii: number[];
    coveragePercentage: number;
}

export class CoverageOptimizer {
    private bestSolution: Solution = { centers: [], radii: [], coveragePercentage: 0 };
    private polygonArea: number;
    private nbTeleop: number[]; // Nb teleop de niveau 1 et 2 dispos

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
        console.log(this.polygonArea);
        
        // Précalcul de l'aire théorique des cercles (utile pour l'élagage)
        const dummyPoint = turf.point([0, 0]);
        this.circle1.area = turf.area(turf.circle(dummyPoint, this.circle1.radius));
        console.log(this.circle1.area);
        this.circle2.area = turf.area(turf.circle(dummyPoint, this.circle2.radius));
    }

    // Fonction de calcul du pourcentage de surface couverte via Turf.js
    private calculateCoveragePercentage(centers: Feature<Point>[], radii: number[]): number {
        if (centers.length === 0) return 0;

        // 1. Créer les géométries des cercles placés
        const circles = centers.map((center, index) => 
            turf.circle(center, radii[index])
        );
        
        // 2. Faire l'union de tous les cercles pour gérer les superpositions
        let unionPolygon: Feature<Polygon | MultiPolygon> = circles[0];
        for (let i = 1; i < circles.length; i++) {
            const unionResult = turf.union(turf.featureCollection([unionPolygon, circles[i]]));
            if (unionResult) {
               unionPolygon = unionResult as Feature<Polygon | MultiPolygon>;
            }
        }

        // 3. Intersecter l'union des cercles avec le polygone cible
        const intersection = turf.intersect(turf.featureCollection([unionPolygon, this.polygon]));

        // 4. Calculer l'aire et la convertir en pourcentage
        const rawArea = intersection ? turf.area(intersection) : 0;
        return (rawArea / this.polygonArea) * 100;
    }

    // Lancement de l'algorithme
    public optimize(): Solution {
        this.explore(0, [], [], this.nbTeleop[0], this.nbTeleop[1], 0);
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
        // On calcule le pourcentage maximal qu'on pourrait théoriquement ajouter (sans superposition)
        const maxPotentialExtraArea = (remTeleopN1 * this.circle1.area) + (remTeleopN2 * this.circle2.area);
        const maxPotentialExtraPercentage = (maxPotentialExtraArea / this.polygonArea) * 100;
        
        // Si le % actuel + le potentiel maximum ne bat pas la meilleure solution connue, on coupe
        if (currentPercentage + maxPotentialExtraPercentage <= this.bestSolution.coveragePercentage) {
            return; 
        }

        // Si on a déjà couvert 99.9% de la surface, on peut s'arrêter (optimisation)
        if (currentPercentage >= 99.9) {
            this.bestSolution = { 
                centers: [...currentCenters], 
                radii: [...currentRadii], 
                coveragePercentage: currentPercentage 
            };
            return;
        }

        const point = this.grid[gridIndex];

        // --- CHOIX A : Placer un cercle de type 1 ---
        if (remTeleopN1 > 0) {
            currentCenters.push(point);
            currentRadii.push(this.circle1.radius);
            
            const newPctC1 = this.calculateCoveragePercentage(currentCenters, currentRadii);
            this.explore(gridIndex + 1, currentCenters, currentRadii, remTeleopN1 - 1, remTeleopN2, newPctC1);
            
            currentCenters.pop(); // Backtracking
            currentRadii.pop();
        }

        // --- CHOIX B : Placer un cercle de type 2 ---
        if (remTeleopN2 > 0) {
            currentCenters.push(point);
            currentRadii.push(this.circle2.radius);
            
            const newPctC2 = this.calculateCoveragePercentage(currentCenters, currentRadii);
            this.explore(gridIndex + 1, currentCenters, currentRadii, remTeleopN1, remTeleopN2 - 1, newPctC2);
            
            currentCenters.pop(); // Backtracking
            currentRadii.pop();
        }

        // --- CHOIX C : Ne rien placer ---
        this.explore(gridIndex + 1, currentCenters, currentRadii, remTeleopN1, remTeleopN2, currentPercentage);
    }
}