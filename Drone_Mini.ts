import { Drone } from './Drone';
import { Point } from './Point';
import { Teleoperateur } from './Teleoperateur';

export class Drone_Mini extends Drone {
    // Pas de vision nocturne 
    public  visionNocturne: boolean = false;

    constructor(champDeVision: number,point: Point,teleoperateur?: Teleoperateur) {
        super(champDeVision, point, teleoperateur);
    }

}