import { Point } from './Point';
import { Teleoperateur } from './Teleoperateur';

export abstract class Drone {
    public champDeVision: number;
    public abstract visionNocturne: boolean;
    public abstract deploimentpluie: boolean;
    public teleoperateur?: Teleoperateur;
    public point: Point;

    constructor(champDeVision: number,point: Point,teleoperateur?: Teleoperateur) {
        this.champDeVision = champDeVision;
        this.point = point;
        this.teleoperateur = teleoperateur;
    }

}