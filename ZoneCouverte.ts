import { Polygon, MultiPolygon } from 'geojson';

export class ZoneCouverte {
    // On remplace la liste de points par la géométrie officielle
    public geometry: Polygon | MultiPolygon;
    public nom?: string;

    constructor(geometry: Polygon | MultiPolygon, nom?: string) {
        this.geometry = geometry;
        this.nom = nom;
    }
}