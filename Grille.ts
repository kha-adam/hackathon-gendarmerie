import * as turf from '@turf/turf';
import { Point } from './Point';
import { ZoneCouverte } from './ZoneCouverte';

export class Grille {
    public points: Point[];

    constructor(points: Point[] = []) {
        this.points = points;
    }

    /**
     * Génère une grille de points basée sur les extremums (min/max) de la zone, 
        avec une marge pour couvrir un peu plus de terrain.
        @param precision Distance entre les points (en kilomètres)
        @param zone La ZoneCouverte (Polygone GeoJSON)
        @param margeKm Marge supplémentaire à ajouter autour de la zone (en kilomètres)
        @returns Grille
     */
    public static newGrid(precision: number, zone: ZoneCouverte, margeKm: number = 0.1): Grille {
        const featureZone = turf.feature(zone.geometry);
        
        // 1. Calcul de la Bounding Box de base (min longitude, min latitude, max longitude, max latitude)
        const baseBbox = turf.bbox(featureZone);

        // 2. Transformer cette Bounding Box en Polygone rectangulaire pour pouvoir l'agrandir
        const bboxPolygon = turf.bboxPolygon(baseBbox);

        // 3. Ajouter la marge ("couvrir un peu plus, mais pas trop loin")
        const expandedPolygon = turf.buffer(bboxPolygon, margeKm, { units: 'kilometers' });

        // 4. Recalculer la nouvelle Bounding Box agrandie
        const expandedBbox = turf.bbox(expandedPolygon);

        // 5. Générer la grille sur cette nouvelle zone rectangulaire élargie
        const options: { units: turf.Units } = { units: 'kilometers' };
        const gridCollection = turf.pointGrid(expandedBbox, precision, options);

        const grillePoints: Point[] = [];

        // 6. On récupère tous les points de cette grille rectangulaire
        // (On retire le filtre booleanPointInPolygon car vous voulez parcourir la zone min/max entière)
        for (const featurePoint of gridCollection.features) {
            const [lon, lat] = featurePoint.geometry.coordinates;
            grillePoints.push(new Point(lon, lat));
        }

        return new Grille(grillePoints);
    }
}