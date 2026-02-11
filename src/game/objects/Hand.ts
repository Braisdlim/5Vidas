import { GameObjects, Scene } from 'phaser';
import type { Card } from '../../engine/types';
import { EventBus } from '../EventBus';

export class Hand extends GameObjects.Container {
    private cards: Map<string, GameObjects.Container> = new Map();
    private cardWidth = 146 / 2; // Assuming 2x scale
    private cardHeight = 226 / 2;
    private selectedCardId: string | null = null;
    private maxSpacing = 50; // Max overlap
    private lastSpacing = 0;
    private lastTotalWidth = 0;
    private isAnimating = false;
    private layoutTimer?: Phaser.Time.TimerEvent;
    private debugHitboxes = false;
    private debugBoxes: Map<string, GameObjects.Graphics> = new Map();

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
    }

    public updateHand(handData: Card[]) {
        const currentIds = new Set(this.cards.keys());
        const newIds = new Set(handData.map(c => c.id));

        // Remove cards
        for (const id of currentIds) {
            if (!newIds.has(id)) {
                const card = this.cards.get(id);
                if (card) {
                    this.remove(card);
                    card.destroy();
                    this.cards.delete(id);
                }
            }
        }

        // Add new cards
        handData.forEach((cardData) => {
            if (!this.cards.has(cardData.id)) {
                const card = this.createCardSprite(cardData);
                this.add(card);
                this.cards.set(cardData.id, card);
                card.y += 100; // Spawn animation
            }
        });

        // Reset selection if played card was selected
        if (this.selectedCardId && !this.cards.has(this.selectedCardId)) {
            this.selectedCardId = null;
        }

        this.layoutCards(handData);
    }

    private createCardSprite(cardData: Card): GameObjects.Container {
        const container = new GameObjects.Container(this.scene, 0, 0);
        container.setSize(this.cardWidth, this.cardHeight);



        // Calculate Texture Key
        // Suits: Oros, Copas, Espadas, Bastos
        const suits = ['oros', 'copas', 'espadas', 'bastos'];
        let suitIndex = suits.indexOf(cardData.suit.toLowerCase());
        if (suitIndex === -1) suitIndex = 0; // Fallback

        // Ranks: 1-7 -> 1-7; 10-12 -> 8-10
        let rankIndex = cardData.rank;
        if (cardData.rank >= 10) rankIndex = cardData.rank - 2;

        const textureId = (suitIndex * 10) + rankIndex;
        const textureKey = `card-${textureId}`;

        if (this.scene.textures.exists(textureKey)) {
            // Add shadow graphic for depth
            const shadow = new GameObjects.Ellipse(
                this.scene,
                2,
                6,
                this.cardWidth * 0.9,
                this.cardHeight * 0.15,
                0x000000,
                0.3
            );
            container.add(shadow);

            const sprite = new GameObjects.Sprite(this.scene, 0, 0, textureKey);
            sprite.setDisplaySize(this.cardWidth, this.cardHeight);

            // Set Nearest neighbor for pixel art look if needed
            // sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

            container.add(sprite);
        } else {
            // Fallback Graphic
            const gfx = new GameObjects.Graphics(this.scene);
            gfx.fillStyle(0xffffff);
            gfx.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 6);
            gfx.lineStyle(2, 0x000000);
            gfx.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 6);

            const text = new GameObjects.Text(this.scene, 0, 0, `${cardData.rank}\n${cardData.suit[0]}`, {
                color: '#000', fontSize: '20px', align: 'center', fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add([gfx, text]);
        }

        container.setData('id', cardData.id);
        container.setInteractive();
        container.on('pointerdown', () => {
            if (this.isAnimating) return;
            this.handleCardClick(cardData.id);
        });

        return container;
    }

    private handleCardClick(cardId: string) {
        if (this.selectedCardId === cardId) {
            // Confirm Play
            EventBus.emit('card-selected', cardId);
            this.selectedCardId = null;
        } else {
            // Select (Lift)
            this.selectedCardId = cardId;
            this.updateSelectionVisuals();
        }
    }

    public setDebugHitboxes(enabled: boolean) {
        this.debugHitboxes = enabled;
        if (!enabled) {
            for (const gfx of this.debugBoxes.values()) {
                gfx.destroy();
            }
            this.debugBoxes.clear();
        }

        this.layoutCards();
    }

    private updateSelectionVisuals() {
        // Re-layout to apply selection visuals (lifting the selected card)
        this.layoutCards();
    }

    // Store current ordered hand for layout refreshes
    private currentHandData: Card[] = [];

    private layoutCards(handData?: Card[]) {
        if (handData) this.currentHandData = handData;
        const list = this.currentHandData;

        const count = list.length;
        if (count === 0) return;

        const availableWidth = Math.max(this.scene.scale.width - 60, this.cardWidth);
        const totalWidth = Math.min(availableWidth, count * this.maxSpacing);
        const spacing = totalWidth / count;
        const startX = -(totalWidth / 2) + (spacing / 2);

        this.lastSpacing = spacing;
        this.lastTotalWidth = totalWidth;

        this.isAnimating = true;
        if (this.layoutTimer) {
            this.layoutTimer.remove(false);
        }

        list.forEach((c, i) => {
            const card = this.cards.get(c.id);
            if (card) {
                const x = startX + i * spacing;
                const angle = (i - (count - 1) / 2) * 5;
                let y = Math.abs(i - (count - 1) / 2) * 5; // Arch

                // Selection Lift
                if (c.id === this.selectedCardId) {
                    y -= 40; // Lit up
                }

                this.scene.tweens.add({
                    targets: card,
                    x: x,
                    y: y,
                    angle: angle,
                    duration: 200,
                    ease: 'Quad.easeOut'
                });

                const isEdge = i === 0 || i === count - 1;
                const baseHitWidth = Math.max(spacing, this.cardWidth * 0.35);
                const hitWidth = isEdge ? this.cardWidth : baseHitWidth;
                const hitHeight = this.cardHeight * 0.85;
                const hitX = isEdge ? -this.cardWidth / 2 : (this.cardWidth / 2) - hitWidth;
                const hitY = -this.cardHeight / 2;
                const hitArea = new Phaser.Geom.Rectangle(hitX, hitY, hitWidth, hitHeight);
                card.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

                if (this.debugHitboxes) {
                    const gfx = this.getOrCreateDebugBox(c.id, card);
                    gfx.clear();
                    gfx.lineStyle(2, isEdge ? 0x00ff7f : 0xffcc00, 0.9);
                    gfx.strokeRect(hitX, hitY, hitWidth, hitHeight);
                }

                // Depth sorting logic:
                // Standard Fan: Index order (0 at bottom, N at top).
                // But we want to preserve this unless hovered.
                // Since layoutCards is called on pointerout, it restores order.
                // We just need to ensure `this.sort` or strictly `add` order matches index.
                // Container.sort is expensive? We can just sendToBack/bringToTop loop?
                // Actually, just iterating and setting depth is enough if we use setDepth?
                // Container children render order is key.
                this.moveTo(card, i); // Ensure z-index matches index

                if (c.id === this.selectedCardId) {
                    this.bringToTop(card);
                }
            }
        });

        this.layoutTimer = this.scene.time.delayedCall(220, () => {
            this.isAnimating = false;
        });
    }

    private getOrCreateDebugBox(cardId: string, card: GameObjects.Container) {
        let gfx = this.debugBoxes.get(cardId);
        if (!gfx) {
            gfx = new GameObjects.Graphics(this.scene);
            card.add(gfx);
            this.debugBoxes.set(cardId, gfx);
        }

        return gfx;
    }
}
