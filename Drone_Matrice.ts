import { Drone } from './Drone';
import { Point } from './Point';
import { Teleoperateur } from './Teleoperateur';

export class Drone_Matrice extends Drone {
    // La vision nocturne vrai  
    public  visionNocturne: boolean = true;

    constructor(champDeVision: number,point: Point,teleoperateur?: Teleoperateur) {
        super(champDeVision, point, teleoperateur);
    }

}