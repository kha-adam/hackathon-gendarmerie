import { Point } from './Point';
import { Drone } from './Drone';

export class Teleoperateur {
    public niveau: number;
    private portee: number;
    private altitude: number;
    public drone: Drone;
    private point: Point;

    constructor(
        niveau: number,
        portee: number,
        altitude: number,
        point: Point,
        drone: Drone 
    ) {
        this.niveau = niveau;
        this.portee = portee;
        this.altitude = altitude;
        this.point = point;
        this.drone = drone;
    }

    public getPortee(): number {
        return this.portee;
    }

    public setPortee(portee: number): void {
        this.portee = portee;
    }

    public getAltitude(): number {
        return this.altitude;
    }

    public setAltitude(altitude: number): void {
        this.altitude = altitude;
    }

    public getPoint(): Point {
        return this.point;
    }

    public setPoint(point: Point): void {
        this.point = point;
    }
}