import { Point as GeoJSONPoint, Position } from 'geojson';

export class Point implements GeoJSONPoint {
    // Structure stricte GeoJSON
    public type: "Point" = "Point";
    public coordinates: Position; // [longitude, latitude]

    constructor(longitude: number = 0, latitude: number = 0) {
        this.coordinates = [longitude, latitude];
    }
}