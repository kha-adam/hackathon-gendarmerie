import { Feature, Point } from 'geojson';

/**
 * Mélange un tableau de points de manière uniforme (Fisher-Yates).
 * Crée une copie pour ne pas muter la grille originale.
 */
export function shuffleGrid(grid: Feature<Point>[]): Feature<Point>[] {
    const shuffled = [...grid]; // Copie du tableau
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        // Choix d'un index aléatoire entre 0 et i
        const j = Math.floor(Math.random() * (i + 1));
        
        // Échange des éléments (Destructuring assignment)
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}