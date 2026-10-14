import * as turf from '@turf/turf';
import { Feature, Point as GeoJSONPoint, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { Point } from './Point';
import { ZoneCouverte } from './ZoneCouverte';

export class Grille {
    public points: Point[];

    constructor(points: Point[] = []) {
        this.points = points;
    }

    /**
     * Convertit la grille en un tableau de Features GeoJSON
     * Compatible à 100% avec le type de pointGrid.features
     */
    public toFeatures(): Feature<GeoJSONPoint>[] {
        return this.points.map(p => turf.point(p.coordinates));
    }

    /**
     * Convertit la grille en une FeatureCollection GeoJSON complète
     */
    public toFeatureCollection(): FeatureCollection<GeoJSONPoint> {
        return turf.featureCollection(this.toFeatures());
    }

    /**
        Génère une grille de points strictement inclus dans la zone couverte.
        
        @param precision Distance entre les points (en kilomètres)
        @param zone La ZoneCouverte (Polygone ou MultiPolygone GeoJSON)
        @param margeKm Marge optionnelle à ajouter au polygone (0 par défaut)
        @returns Grille
     */
    public static newGrid(precision: number, zone: ZoneCouverte, margeKm: number = 0): Grille {
        // 1. Initialiser la zone cible à partir du polygone
        let zoneCible: Feature<Polygon | MultiPolygon> = turf.feature(zone.geometry);

        // 2. Si une marge positive est spécifiée, agrandir directement le polygone
        if (margeKm > 0) {
            const buffered = turf.buffer(zoneCible, margeKm, { units: 'kilometers' });
            if (buffered) {
                zoneCible = buffered;
            }
        }

        // 3. Calculer la Bounding Box du polygone pour générer la grille de base
        const bbox = turf.bbox(zoneCible);

        // 4. Générer la grille de points sur le rectangle
        const options: { units: turf.Units } = { units: 'kilometers' };
        const gridCollection = turf.pointGrid(bbox, precision, options);

        const grillePoints: Point[] = [];

        // 5. Filtrer : garder uniquement les points qui tombent DANS le polygone
        for (const featurePoint of gridCollection.features) {
            if (turf.booleanPointInPolygon(featurePoint.geometry, zoneCible)) {
                const [lon, lat] = featurePoint.geometry.coordinates;
                grillePoints.push(new Point(lon, lat));
            }
        }

        // 6. Mélange aléatoire (Fisher-Yates)
        for (let i = grillePoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [grillePoints[i], grillePoints[j]] = [grillePoints[j], grillePoints[i]];
        }

        return new Grille(grillePoints);
    }
}