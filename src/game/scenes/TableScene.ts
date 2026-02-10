import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_DIMENSIONS } from '../../engine/constants';
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
        this.trickPile = new TrickPile(this, GAME_DIMENSIONS.WIDTH / 2, GAME_DIMENSIONS.HEIGHT / 2);

        // ── Hand ──
        this.hand = new Hand(this, GAME_DIMENSIONS.WIDTH / 2, GAME_DIMENSIONS.HEIGHT - 50);
        this.add.existing(this.hand);

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

        EventBus.emit('current-scene-ready', this);

        // Start game for testing if no state
        if (!useGameStore.getState().gameState) {
            gameController.startGame(['Tú', 'Bot 1', 'Bot 2', 'Bot 3']);
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

        // Clear existing
        this.opponents.forEach(h => h.destroy());
        this.opponents.clear();

        opponents.forEach((op, index) => {
            // Calculate position based on index relative to me
            // precise logic depends on max players. For now, distributed in top arc.
            const totalOps = opponents.length;
            const x = (GAME_DIMENSIONS.WIDTH / (totalOps + 1)) * (index + 1);
            const y = 80; // Top area

            const hand = new OpponentHand(this, x, y);
            hand.update(op.handSize, op.name, op.isConnected);
            this.opponents.set(op.id, hand);
            this.add.existing(hand);
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
            return { x: GAME_DIMENSIONS.WIDTH / 2, y: GAME_DIMENSIONS.HEIGHT - 100 };
        }

        // Opponents
        const opponentHand = this.opponents.get(playerId);
        if (opponentHand) {
            return { x: opponentHand.x, y: opponentHand.y };
        }

        // Fallback
        return { x: GAME_DIMENSIONS.WIDTH / 2, y: GAME_DIMENSIONS.HEIGHT / 2 };
    }

    private drawTable() {
        const { WIDTH, HEIGHT } = GAME_DIMENSIONS;
        const gfx = this.add.graphics();

        const centerColor = 0x1e4632;
        const cornerColor = 0x05100a;

        gfx.fillGradientStyle(cornerColor, cornerColor, cornerColor, cornerColor, 1);
        gfx.fillRect(0, 0, WIDTH, HEIGHT);

        const light = this.add.graphics();
        light.fillStyle(centerColor, 1);
        light.fillCircle(WIDTH / 2, HEIGHT / 2 - 50, 450);
        light.setBlendMode(Phaser.BlendModes.ADD);
        light.setAlpha(0.2);

        gfx.lineStyle(2, 0xe6b800, 0.8);
        gfx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);

        gfx.lineStyle(1, 0xe6b800, 0.3);
        gfx.strokeRect(14, 14, WIDTH - 28, HEIGHT - 28);
    }

    private drawPlayArea() {
        const { WIDTH, HEIGHT } = GAME_DIMENSIONS;
        const cx = WIDTH / 2;
        const cy = HEIGHT / 2 - 40;

        const gfx = this.add.graphics();
        gfx.lineStyle(1, 0xffffff, 0.1);
        gfx.strokeRoundedRect(cx - 130, cy - 90, 260, 180, 24);

        gfx.lineStyle(2, 0xe6b800, 0.4);
        gfx.beginPath(); gfx.moveTo(cx - 120, cy - 90); gfx.lineTo(cx - 130, cy - 90); gfx.lineTo(cx - 130, cy - 80); gfx.strokePath();
        gfx.beginPath(); gfx.moveTo(cx + 120, cy - 90); gfx.lineTo(cx + 130, cy - 90); gfx.lineTo(cx + 130, cy - 80); gfx.strokePath();
        gfx.beginPath(); gfx.moveTo(cx - 120, cy + 90); gfx.lineTo(cx - 130, cy + 90); gfx.lineTo(cx - 130, cy + 80); gfx.strokePath();
        gfx.beginPath(); gfx.moveTo(cx + 120, cy + 90); gfx.lineTo(cx + 130, cy + 90); gfx.lineTo(cx + 130, cy + 80); gfx.strokePath();
    }

    shutdown() {
        if (this.unsubscribeStore) this.unsubscribeStore();
    }
}
