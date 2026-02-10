import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Load minimal assets needed for the preloader screen
        // (loading bar background, etc.)
    }

    create() {
        this.scene.start('Preloader');
    }
}
