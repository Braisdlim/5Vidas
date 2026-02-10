import { GameObjects, Scene } from 'phaser';
import type { PlayedCard, Player } from '../../engine/types';


export class TrickPile extends GameObjects.Container {
    private cardSprites: Map<string, GameObjects.Container> = new Map();
    private cardWidth = 146 / 2 * 0.8;
    private cardHeight = 226 / 2 * 0.8;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
    }

    public updateTrick(trick: PlayedCard[], players: Player[], myPlayerId: string) {
        // Remove cards not in trick (e.g., cleared)
        const currentIds = new Set(this.cardSprites.keys());
        const newIds = new Set(trick.map(pc => pc.card.id));

        for (const id of currentIds) {
            if (!newIds.has(id)) {
                const sprite = this.cardSprites.get(id);
                if (sprite) {
                    // Logic: Animate to winner?
                    // For now, simple destroy (animation handled by TableScene transition logic optionally)
                    // If we just destroy here, it disappears.
                    // We can emit event or just fade out.
                    this.scene.tweens.add({
                        targets: sprite,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => {
                            sprite.destroy();
                            this.remove(sprite);
                        }
                    });
                    this.cardSprites.delete(id);
                }
            }
        }

        // Add/Update cards
        const myIndex = players.findIndex(p => p.id === myPlayerId);
        const totalPlayers = players.length;

        trick.forEach((pc) => {
            let sprite = this.cardSprites.get(pc.card.id);

            // Calculate target position based on player seat relative to me
            const playerIndex = players.findIndex(p => p.id === pc.playerId);
            const relativeIdx = (playerIndex - myIndex + totalPlayers) % totalPlayers;

            // Layout: 0 (Me) -> Bottom, 1 -> Right, etc. (Counter-Clockwise? or Clockwise?)
            // Standard: Clockwise.
            // 0: Bottom (0, 60)
            // 1: Right (80, 0)
            // 2: Top (0, -60)
            // 3: Left (-80, 0)

            // General formula for N players circle
            const angle = (Math.PI * 2 * relativeIdx) / totalPlayers + Math.PI / 2; // +90deg to start bottom?
            // Wait, relativeIdx 0 = Me. Angle PI/2 = Bottom defined in standard trig?
            // Trig 0 = Right, PI/2 = Bottom, PI = Left, 3PI/2 = Top.
            // Let's use simple lookup or logic.

            const radius = 60;
            const targetX = Math.cos(angle) * radius; // If angle 0 -> right. 
            const targetY = Math.sin(angle) * radius;

            // Correction: active player 0 should be at Bottom (0, radius).

            if (!sprite) {
                // Create new
                sprite = this.createCardSprite(pc);
                this.add(sprite);
                this.cardSprites.set(pc.card.id, sprite);

                // Initial pos: from player direction (offscreen or hand pos)
                sprite.x = targetX * 3;
                sprite.y = targetY * 3;
                sprite.setScale(0.5);

                // Animate in
                this.scene.tweens.add({
                    targets: sprite,
                    x: targetX,
                    y: targetY,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 300,
                    ease: 'Back.easeOut'
                });
            } else {
                // Ensure correct position (e.g. if window resized or order changed?)
                // Usually static once played.
            }
        });
    }

    private createCardSprite(pc: PlayedCard): GameObjects.Container {
        const container = new GameObjects.Container(this.scene, 0, 0);

        // Calculate Texture Key
        // Suits: Oros, Copas, Espadas, Bastos
        const suits = ['oros', 'copas', 'espadas', 'bastos'];
        let suitIndex = suits.indexOf(pc.card.suit.toLowerCase());
        if (suitIndex === -1) suitIndex = 0; // Fallback

        // Ranks: 1-7 -> 1-7; 10-12 -> 8-10
        let rankIndex = pc.card.rank;
        if (pc.card.rank >= 10) rankIndex = pc.card.rank - 2;

        const textureId = (suitIndex * 10) + rankIndex;
        const textureKey = `card-${textureId}`;

        if (this.scene.textures.exists(textureKey)) {
            const sprite = new GameObjects.Sprite(this.scene, 0, 0, textureKey);
            sprite.setDisplaySize(this.cardWidth, this.cardHeight);
            // sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            container.add(sprite);
        } else {
            // Fallback
            const gfx = new GameObjects.Graphics(this.scene);
            gfx.fillStyle(0xfff8e7);
            gfx.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 6);
            gfx.lineStyle(2, 0x000000); // Black border
            gfx.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 6);

            // Text
            const text = new GameObjects.Text(this.scene, -15, -20, String(pc.card.rank), {
                color: '#000', fontSize: '18px', fontStyle: 'bold'
            });
            const suit = new GameObjects.Text(this.scene, -10, 0, pc.card.suit[0], {
                color: '#000', fontSize: '24px'
            });
            // Suit color logic
            const color = ['Oros', 'Copas'].includes(pc.card.suit) ? '#d32f2f' : '#333';
            suit.setColor(color);

            container.add([gfx, text, suit]);
        }

        return container;
    }
}
