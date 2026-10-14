import * as fs from 'fs';
import { ZoneCouverte } from './ZoneCouverte';
import { GeoJSON, Polygon, MultiPolygon } from 'geojson';

export class GeoJSONReader {
    /**
     * Lit un fichier GeoJSON et extrait sa géométrie Polygon/MultiPolygon.
     */
    public static lireFichierGeoJSON(cheminFichier: string, nomZone?: string): ZoneCouverte {
        const contenuFichier = fs.readFileSync(cheminFichier, 'utf-8');
        const parsedData = JSON.parse(contenuFichier) as GeoJSON;
        
        let nomExtrait = nomZone;
        let geometryExtrait: Polygon | MultiPolygon | null = null;

        // Parcours du GeoJSON pour trouver le polygone
        if (parsedData.type === 'FeatureCollection') {
            nomExtrait = nomExtrait || (parsedData as any).name || 'Zone FeatureCollection';
            
            for (const feature of parsedData.features) {
                if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                    geometryExtrait = feature.geometry;
                    nomExtrait = nomExtrait || (feature.properties?.name as string);
                    break; // On extrait le premier polygone trouvé pour définir la zone
                }
            }
        } else if (parsedData.type === 'Feature') {
            nomExtrait = nomExtrait || (parsedData.properties?.name as string) || 'Zone Feature';
            
            if (parsedData.geometry && (parsedData.geometry.type === 'Polygon' || parsedData.geometry.type === 'MultiPolygon')) {
                geometryExtrait = parsedData.geometry;
            }
        } else if (parsedData.type === 'Polygon' || parsedData.type === 'MultiPolygon') {
            geometryExtrait = parsedData;
            nomExtrait = nomExtrait || 'Zone Géométrie pure';
        }

        if (!geometryExtrait) {
            throw new Error("❌ Aucun polygone (Polygon ou MultiPolygon) n'a été trouvé dans le fichier GeoJSON.");
        }

        return new ZoneCouverte(geometryExtrait, nomExtrait || "Zone Sans Nom");
    }
}