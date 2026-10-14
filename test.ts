import * as path from 'path';
import { GeoJSONReader } from './GeoJSONReader';
import { ZoneCouverte } from './ZoneCouverte';

const nomFichier = process.argv[2];

if (!nomFichier) {
    console.error("❌ Erreur : Veuillez fournir le chemin d'un fichier GeoJSON.");
    console.log("Usage : npx tsx test.ts <chemin/vers/fichier.geojson>");
    process.exit(1);
}

const cheminAbsolu = path.resolve(nomFichier);

try {
    console.log(`[TEST] Traitement du fichier : ${cheminAbsolu}...\n`);
    
    // Traduction du fichier en objet ZoneCouverte avec la géométrie native
    const zone: ZoneCouverte = GeoJSONReader.lireFichierGeoJSON(cheminAbsolu);

    // Affichage du log
    console.log("✅ --- RÉSULTAT DU PARSING ---");
    console.log(`- Nom de la zone     : "${zone.nom}"`);
    console.log(`- Type de géométrie  : ${zone.geometry.type}`);
    
    if (zone.geometry.type === 'Polygon') {
        const nbAnneaux = zone.geometry.coordinates.length;
        const nbPointsExterieurs = zone.geometry.coordinates[0].length;
        console.log(`- Anneaux (Rings)    : ${nbAnneaux} (L'anneau [0] est le contour extérieur)`);
        console.log(`- Sommets du contour : ${nbPointsExterieurs}`);
        console.log(`- Premier sommet     :`, zone.geometry.coordinates[0][0]);
    }
    
    console.log("------------------------------\n");

} catch (error: any) {
    console.error("❌ Erreur lors de la lecture ou du parsing du fichier :");
    console.error(error.message);
}