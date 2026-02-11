import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { gameController } from '../GameController';
import type { GameState } from '../../engine/types';
import { Hand } from '../objects/Hand';
import { OpponentHand } from '../objects/OpponentHand';
import { TrickPile } from '../objects/TrickPile';
import { ParticleManager } from '../objects/ParticleManager';

export class TableScene extends Scene {
    private hand!: Hand;
    private opponents: Map<string, OpponentHand> = new Map();
    private trickPile!: TrickPile;
    private particleManager!: ParticleManager;
    private unsubscribeStore!: () => void;

    constructor() {
        super('TableScene');
    }

    create() {
        this.input.topOnly = true;
        // ── Init Controller & Store ──
        const existingId = useGameStore.getState().myPlayerId;
        gameController.init(existingId || crypto.randomUUID());
        // Wait, gameController.init() doesn't return ID, uses existing or passed.
        // Let's get ID from localStorage via App?
        // Actually, App.tsx sets up identity in localStorage.
        // We can read it here or pass via data.
        // For now, let's assume game started by App.

        // ── Event Bus ──
        const onCardSelected = (cardId: string) => {
            const myPlayer = useGameStore.getState().getMyPlayer();
            if (!myPlayer) return;
            const index = myPlayer.hand.findIndex(c => c.id === cardId);
            if (index !== -1) {
                gameController.playCard(index);
            }
        };
        EventBus.on('card-selected', onCardSelected);

        // ── Event Bus Listeners for FX ──
        EventBus.on('fx-win-trick', this.handleWinTrick, this);
        EventBus.on('fx-life-lost', this.handleLifeLost, this);
        EventBus.on('fx-game-win', this.handleGameWin, this);

        // Cleanup on shutdown
        this.events.on('shutdown', () => {
            if (this.unsubscribeStore) this.unsubscribeStore();
            EventBus.off('card-selected', onCardSelected);
            EventBus.off('fx-win-trick', this.handleWinTrick, this);
            EventBus.off('fx-life-lost', this.handleLifeLost, this);
            EventBus.off('fx-game-win', this.handleGameWin, this);
        });

        // ── Table background ──
        this.drawTable();

        // ── Trick Pile ──
        this.trickPile = new TrickPile(this, this.scale.width / 2, this.scale.height / 2);

        // ── Hand ──
        this.hand = new Hand(this, this.scale.width / 2, this.scale.height - 50);
        this.add.existing(this.hand);
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.has('hitbox')) {
                this.hand.setDebugHitboxes(true);
            }
        }

        // ── Particle Manager ──
        this.particleManager = new ParticleManager(this);

        // Subscribe to store
        this.unsubscribeStore = useGameStore.subscribe((state) => {
            if (state.gameState) {
                this.updateState(state.gameState);
            }
        });

        // ── Central play area indicator ──
        this.drawPlayArea();

        // ── Scoreboard toggle button (inside canvas) ──
        this.createScoreboardButton();

        // ── Resize listener for fullscreen ──
        this.scale.on('resize', this.handleResize, this);

        EventBus.emit('current-scene-ready', this);

        // Start game for testing if no state
        if (!useGameStore.getState().gameState) {
            gameController.startGame(['Tú', 'Bot 1', 'Bot 2', 'Bot 3']);
        }
    }

    private scoreboardButton?: Phaser.GameObjects.Container;

    private createScoreboardButton() {
        // Container for the button (top-right corner)
        this.scoreboardButton = this.add.container(this.scale.width - 40, 40);

        // Background circle
        const bg = this.add.circle(0, 0, 28, 0x0d1f15, 0.95);
        bg.setStrokeStyle(2, 0xe6b800);

        // Icon text (emoji)
        const icon = this.add.text(0, 0, '📊', {
            fontSize: '24px'
        });
        icon.setOrigin(0.5);

        this.scoreboardButton.add([bg, icon]);
        this.scoreboardButton.setSize(56, 56);
        this.scoreboardButton.setInteractive({ useHandCursor: true });

        // Click handler - emit event to React
        this.scoreboardButton.on('pointerdown', () => {
            EventBus.emit('toggle-scoreboard');
        });

        // Hover effects
        this.scoreboardButton.on('pointerover', () => {
            this.tweens.add({
                targets: bg,
                scale: 1.1,
                duration: 150,
                ease: 'Back.easeOut'
            });
        });

        this.scoreboardButton.on('pointerout', () => {
            this.tweens.add({
                targets: bg,
                scale: 1.0,
                duration: 150,
                ease: 'Quad.easeOut'
            });
        });

        // High depth to stay on top
        this.scoreboardButton.setDepth(1000);
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;

        // Redraw background and play area
        this.drawTable();
        this.drawPlayArea();

        // Reposicionar botón scoreboard
        if (this.scoreboardButton) {
            this.scoreboardButton.setPosition(width - 40, 40);
        }

        // Reposicionar mi mano
        if (this.hand) {
            this.hand.setPosition(width / 2, height - 50);
            // Force layout update if Hand has resize method?
            // Hand doesn't have explicit resize, but its internal layout might need refresh
            // For now just position is enough as cards are relative to container
        }

        // Reposicionar TrickPile
        if (this.trickPile) {
            this.trickPile.setPosition(width / 2, height / 2);
        }

        // Reposicionar Oponentes
        // Necesitamos el orden original. Lo más fácil es re-ejecutar updateState con el estado actual
        const state = useGameStore.getState().gameState;
        if (state) {
            this.updateState(state);
        }
    }

    private updateState(state: GameState) {
        if (!this.sys || !this.sys.displayList) return; // Scene not ready or destroyed
        const myId = useGameStore.getState().myPlayerId;
        if (!myId) return;

        // Update Hand
        const myPlayer = state.players.find(p => p.id === myId);
        if (myPlayer) {
            this.hand.updateHand(myPlayer.hand);
        }

        // Create opponent hands
        const opponents = state.players.filter(p => p.id !== myId);

        // Identify current opponent IDs
        const currentOpponentIds = new Set(opponents.map(p => p.id));

        // Remove opponents that are no longer in the game
        for (const [id, hand] of this.opponents.entries()) {
            if (!currentOpponentIds.has(id)) {
                hand.destroy();
                this.opponents.delete(id);
            }
        }

        // Update or Create opponents
        opponents.forEach((op, index) => {
            const pos = this.getOpponentPosition(index, opponents.length);

            let hand = this.opponents.get(op.id);
            if (!hand) {
                // New opponent
                hand = new OpponentHand(this, pos.x, pos.y);
                this.add.existing(hand);
                this.opponents.set(op.id, hand);
            } else {
                // Existing opponent: update position (in case of resize or player count change)
                hand.setPosition(pos.x, pos.y);
                // Ensure it's on top if needed, or just let strict ordering handle it
                // this.children.bringToTop(hand); 
            }

            // Update internal state (cards, name, status)
            // efficient update inside OpponentHand handles diffing
            hand.update(op.handSize, op.name, op.isConnected, op.isEliminated);
        });

        // Cleanup opponents if left? (Not needed for fixed room size usually)

        // Update Trick
        this.trickPile.updateTrick(state.currentTrick, state.players, myId);
    }

    private handleWinTrick({ playerId }: { playerId: string }) {
        const { x, y } = this.getPlayerPosition(playerId);
        this.particleManager.createGoldBurst(x, y);
    }

    private handleLifeLost({ playerId }: { playerId: string }) {
        const { x, y } = this.getPlayerPosition(playerId);
        this.particleManager.createLifeLost(x, y);
    }

    private handleGameWin() {
        this.particleManager.createConfetti();
    }

    private getPlayerPosition(playerId: string): { x: number, y: number } {
        const state = useGameStore.getState();
        const myPlayerId = state.myPlayerId;

        // Me
        if (playerId === myPlayerId) {
            return { x: this.scale.width / 2, y: this.scale.height - 100 };
        }

        // Opponents
        const opponentHand = this.opponents.get(playerId);
        if (opponentHand) {
            return { x: opponentHand.x, y: opponentHand.y };
        }

        // Fallback
        return { x: this.scale.width / 2, y: this.scale.height / 2 };
    }

    private getOpponentPosition(index: number, total: number): { x: number, y: number } {
        const WIDTH = this.scale.width;
        const HEIGHT = this.scale.height;
        const cx = WIDTH / 2;
        const cy = HEIGHT / 2;

        // Radii for the ellipse (padding from edges)
        const PAD_X = 80;
        const PAD_Y = 60;
        const rx = (WIDTH / 2) - PAD_X;
        const ry = (HEIGHT / 2) - PAD_Y;

        // Strategy: Dynamic Arc
        // Me is at 90deg (Bottom). Opponents distributed from Left (approx 190) to Right (approx 350).

        if (total === 1) {
            // Single opponent: Top Center (270deg)
            return { x: cx, y: cy - ry };
        }

        // For 2+ opponents, distribute evenly in the arc
        // index 0 -> ARC_START
        // index total-1 -> ARC_END
        const angleDeg = 190 + ((350 - 190) / (total > 1 ? total - 1 : 1)) * index;

        const angleRad = Phaser.Math.DegToRad(angleDeg);

        return {
            x: cx + rx * Math.cos(angleRad),
            y: cy + ry * Math.sin(angleRad)
        };
    }

    private drawTable() {
        const WIDTH = this.scale.width;
        const HEIGHT = this.scale.height;

        // Clear previous graphics if any (though usually we just create new ones,
        // better to group them in a container or clear specifically if redrawing.
        // For now, simpler to just draw. But on resize we need to clear!)

        // Buscar si ya existen graphics de fondo para eliminarlos?
        // En resize event llamaremos a this.scene.restart() o similar? 
        // No, mejor tener referencias a los graphics y limpiar.

        // Simplemente creamos nuevos graphics, pero Phaser acumulará objetos si llamamos repetidamente.
        // Solución: Asignar a propiedades de clase y destruir si existen.
        if (this.backgroundGraphics) this.backgroundGraphics.destroy();

        this.backgroundGraphics = this.add.graphics();
        const gfx = this.backgroundGraphics;

        // Darker corners, lighter center for premium feel
        const centerColor = 0x2a5a3f;
        const cornerColor = 0x030a06;

        // Use solid fill first to avoid gradient triangulation artifacts
        gfx.fillStyle(cornerColor, 1);
        gfx.fillRect(0, 0, WIDTH, HEIGHT);

        // Stronger radial light in center (increased radius)
        gfx.fillStyle(centerColor, 0.35);
        gfx.fillCircle(WIDTH / 2, HEIGHT / 2 - 50, Math.max(WIDTH, HEIGHT) * 0.8);

        // Vignette effect
        // Note: Multiply blend mode isn't easily available on single Graphics fill
        // So we just use a dark overlay
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillRect(0, 0, WIDTH, HEIGHT);

        // Gold border (premium) - responsive
        gfx.lineStyle(2, 0xe6b800, 0.9);
        gfx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);

        gfx.lineStyle(1, 0xe6b800, 0.4);
        gfx.strokeRect(14, 14, WIDTH - 28, HEIGHT - 28);

        gfx.setDepth(-100); // Send to back
    }

    private backgroundGraphics?: Phaser.GameObjects.Graphics;
    private playAreaGraphics?: Phaser.GameObjects.Graphics;
    private playAreaLabel?: Phaser.GameObjects.Text;

    private drawPlayArea() {
        const WIDTH = this.scale.width;
        const HEIGHT = this.scale.height;
        const cx = WIDTH / 2;
        const cy = HEIGHT / 2 - 20; // Slightly higher center

        if (this.playAreaGraphics) this.playAreaGraphics.destroy();
        if (this.playAreaLabel) this.playAreaLabel.destroy();

        this.playAreaGraphics = this.add.graphics();
        const gfx = this.playAreaGraphics;

        // Outer circle with subtle fill
        gfx.fillStyle(0x1a3a2a, 0.2);
        gfx.fillCircle(cx, cy, 160);

        // Main circle border (gold)
        gfx.lineStyle(3, 0xe6b800, 0.5);
        gfx.strokeCircle(cx, cy, 160);

        // Inner circle border (subtle)
        gfx.lineStyle(1, 0xe6b800, 0.25);
        gfx.strokeCircle(cx, cy, 130);

        gfx.setDepth(-50); // Behind cards but above table
    }

    shutdown() {
        if (this.unsubscribeStore) this.unsubscribeStore();
    }
}
