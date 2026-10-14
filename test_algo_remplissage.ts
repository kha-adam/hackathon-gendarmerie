import * as turf from '@turf/turf';
import { CoverageOptimizer } from './algo_remplissage'; // votre fichier

// Création d'un carré d'environ 11x11 km (0.1 degré de côté)
const squarePolygon = turf.polygon([[
    [0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]
]]);

// Création d'une grille de 4 points, proportionnelle au nouveau carré
const grid = [
    turf.point([0.025, 0.025]), turf.point([0.075, 0.025]),
    turf.point([0.025, 0.075]), turf.point([0.075, 0.075])
];

// Le rayon est interprété en kilomètres par Turf par défaut.
// 2.5 km couvre une bonne partie d'un quart de ce polygone.
const circle1 = { radius: 2.5, area: 0 };
const circle2 = { radius: 4.0, area: 0 }; // Non utilisé ici

const nb_teleop = [4, 2];

const optimizer = new CoverageOptimizer(squarePolygon, grid, circle1, circle2, nb_teleop);
const result = optimizer.optimize(20, 30);

// Vérifications
console.log("Aire totale du polygone (m²) :", turf.area(squarePolygon));
console.log("Cercles placés :", result.centers.length); // Devrait être 2
console.log("Cercles", result.centers);
console.log("Rayons", result.radii);
console.log("Surface couverte :", result.coveragePercentage.toFixed(2), "%");