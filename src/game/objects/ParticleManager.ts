import { Scene } from 'phaser';

export class ParticleManager {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public createGoldBurst(x: number, y: number) {
        const emitter = this.scene.add.particles(x, y, 'flare', {
            speed: { min: 100, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 800,
            quantity: 20,
            tint: [0xffd700, 0xffa500]
        });

        // Auto destroy
        this.scene.time.delayedCall(1000, () => emitter.destroy());
    }

    public createLifeLost(x: number, y: number) {
        const emitter = this.scene.add.particles(x, y, 'flare', {
            speed: { min: 50, max: 150 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            blendMode: 'NORMAL',
            lifespan: 1000,
            quantity: 15,
            tint: [0xff0000, 0x8b0000] // Red
        });

        this.scene.time.delayedCall(1200, () => emitter.destroy());
    }

    public createConfetti() {
        const { width } = this.scene.scale;
        const emitter = this.scene.add.particles(width / 2, -50, 'flare', {
            x: { min: 0, max: width },
            y: -50,
            speedY: { min: 100, max: 300 },
            speedX: { min: -50, max: 50 },
            lifespan: 4000,
            scale: { start: 0.4, end: 0.1 },
            quantity: 2,
            frequency: 100, // Emit every 100ms
            tint: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff],
            gravityY: 100
        });

        // Stop emitting after 5s but let particles fall
        this.scene.time.delayedCall(5000, () => {
            emitter.stop();
            this.scene.time.delayedCall(5000, () => emitter.destroy());
        });
    }
}
