import { GameObjects, Scene } from 'phaser';

export class OpponentHand extends GameObjects.Container {
    private cardBacks: GameObjects.Container[] = [];
    private cardWidth = 146 / 2 * 0.7; // Smaller for opponents
    private cardHeight = 226 / 2 * 0.7;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
    }

    public updateHandSize(count: number) {
        // Simple reconcile logic: match array length to count
        while (this.cardBacks.length < count) {
            const card = this.createCardBack();
            this.add(card);
            this.cardBacks.push(card);
        }

        while (this.cardBacks.length > count) {
            const card = this.cardBacks.pop();
            if (card) {
                card.destroy();
            }
        }

        this.layoutCards(count);
    }

    private createCardBack(): GameObjects.Container {
        const container = new GameObjects.Container(this.scene, 0, 0);

        if (this.scene.textures.exists('card-back')) {
            const sprite = new GameObjects.Sprite(this.scene, 0, 0, 'card-back');
            sprite.setDisplaySize(this.cardWidth, this.cardHeight);
            // sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            container.add(sprite);
        } else {
            const gfx = new GameObjects.Graphics(this.scene);
            // Card back design
            gfx.fillStyle(0x8b1a1a, 1);
            gfx.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 4);
            gfx.lineStyle(1, 0xe6b800, 0.6);
            gfx.strokeRoundedRect(-this.cardWidth / 2 + 2, -this.cardHeight / 2 + 2, this.cardWidth - 4, this.cardHeight - 4, 3);
            container.add(gfx);
        }
        return container;
    }

    private layoutCards(count: number) {
        if (count === 0) return;

        const totalWidth = count * (this.cardWidth * 0.4); // Overlap
        const startX = -(totalWidth / 2) + (this.cardWidth * 0.2);

        this.cardBacks.forEach((card, i) => {
            const x = startX + i * (this.cardWidth * 0.4);
            const angle = (i - (count - 1) / 2) * 3;

            this.scene.tweens.add({
                targets: card,
                x: x,
                y: Math.abs(angle), // Arch
                angle: angle,
                duration: 200,
                ease: 'Quad.easeOut'
            });
        });
    }
}
