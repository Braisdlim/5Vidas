import { useGameStore } from '../store/gameStore';
import {
    startNewRound,
    makePrediction,
    playCard,
    resolveTrickState,
    applyScores
} from '../engine/round';
import { getValidMoves } from '../engine/rules';
import { GAME_CONFIG, ANIM, PLAYER_COLORS } from '../engine/constants';
import type { GameState, Player } from '../engine/types';
import { multiplayer } from '../network/MultiplayerClient';
import { audioManager } from '../engine/AudioManager';
import { EventBus } from './EventBus';

class GameController {
    private static instance: GameController;
    private timerInterval: any = null;
    private botTimeout: any = null;
    private state: GameState | null = null;
    private myPlayerId: string | null = null;
    private isOnline: boolean = false;

    private constructor() { }

    public static getInstance(): GameController {
        if (!GameController.instance) {
            GameController.instance = new GameController();
        }
        return GameController.instance;
    }

    public init(myPlayerId: string) {
        this.myPlayerId = myPlayerId;
        useGameStore.getState().setMyPlayerId(myPlayerId);
    }

    public setOnlineMode(enabled: boolean) {
        this.isOnline = enabled;
        if (enabled) {
            // Stop local timers
            if (this.timerInterval) clearInterval(this.timerInterval);
            if (this.botTimeout) clearTimeout(this.botTimeout);
        }
    }

    public startGame(playerNames: string[]) {
        if (this.isOnline) {
            multiplayer.send("start_game");
            return;
        }

        const players: Player[] = playerNames.map((name, i) => ({
            id: i === 0 && this.myPlayerId ? this.myPlayerId : `bot_${i}`,
            name,
            lives: GAME_CONFIG.STARTING_LIVES,
            hand: [],
            handSize: 0,
            isEliminated: false,
            isConnected: true,
            prediction: -1,
            tricksWon: 0,
            seatIndex: i,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            isBot: i !== 0 // First player is human
        }));

        this.state = {
            phase: 'lobby',
            players,
            currentRound: 0,
            cardsThisRound: 0,
            dealerIndex: players.length - 1,
            activePlayerIndex: 0,
            currentTrick: [],
            trickNumber: 1,
            winnerId: null,
            turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
        };

        // Start first round
        this.advanceRound();
    }

    public makePrediction(val: number) {
        if (this.isOnline) {
            multiplayer.send("predict", val);
            return;
        }

        if (!this.state || !this.myPlayerId) return;

        const playerIdx = this.state.players.findIndex(p => p.id === this.myPlayerId);
        if (playerIdx === -1) return;

        const result = makePrediction(this.state, playerIdx, val);
        if (result.success && result.newState) {
            audioManager.playClick();
            this.updateState(result.newState);
            this.checkPhaseTransition();
        } else {
            console.warn("Prediction failed:", result.error);
        }
    }

    public playCard(cardIndex: number) {
        if (this.isOnline) {
            multiplayer.send("play_card", cardIndex);
            return;
        }

        if (!this.state || !this.myPlayerId) return;

        const playerIdx = this.state.players.findIndex(p => p.id === this.myPlayerId);
        if (playerIdx === -1) return;

        const result = playCard(this.state, playerIdx, cardIndex);
        if (result.success && result.newState) {
            audioManager.playCardFlip();
            this.updateState(result.newState);
            this.checkPhaseTransition();
        } else {
            console.warn("Card play failed:", result.error);
        }
    }

    public continueRound() {
        if (!this.state || this.state.phase !== 'scoring') return;
        this.advanceRound();
    }

    private advanceRound() {
        if (!this.state) return;
        const updates = startNewRound(this.state);
        audioManager.playDeal();
        this.updateState(updates);
        this.startTurnTimer();
    }

    private updateState(updates: Partial<GameState>) {
        if (!this.state) return;
        this.state = { ...this.state, ...updates };
        useGameStore.getState().setGameState(this.state);
    }

    private checkPhaseTransition() {
        if (!this.state) return;

        if (this.state.phase === 'trickResolve') {
            // Wait for visual trick resolution (cards moving to center), then resolve logic
            setTimeout(() => {
                if (!this.state) return;
                const updates = resolveTrickState(this.state);

                // Emit FX event for trick winner
                if (updates.winnerId) {
                    EventBus.emit('fx-win-trick', { playerId: updates.winnerId });
                }

                this.updateState(updates);

                // Check if that resolution triggered end of round (scoring)
                if (this.state?.phase === 'scoring') {
                    // Logic: Round over -> apply scores
                    const scoreUpdates = applyScores(this.state);
                    audioManager.playRoundWin();

                    // Emit FX for life loss
                    scoreUpdates.players?.forEach(p => {
                        const oldP = this.state?.players.find(old => old.id === p.id);
                        if (oldP && p.lives < oldP.lives) {
                            EventBus.emit('fx-life-lost', { playerId: p.id });
                        }
                    });

                    // Check for Game Over winner?
                    // Implementation note: applyScores checks elimination but doesn't set phase to gameOver explicitly?
                    // Wait, applyScores might set phase to 'gameOver'.
                    if (scoreUpdates.phase === 'gameOver') {
                        EventBus.emit('fx-game-win');
                    }

                    this.updateState(scoreUpdates);
                } else {
                    // Next trick starts
                    this.startTurnTimer();
                }
            }, ANIM.POST_TRICK_PAUSE);
        } else if (this.state.phase === 'playing' || this.state.phase === 'predicting') {
            this.startTurnTimer();
        }
    }

    private startTurnTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.botTimeout) clearTimeout(this.botTimeout);

        if (!this.state) return;

        this.updateState({ turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS });

        // Check if current player is Bot
        const currentPlayer = this.state.players[this.state.activePlayerIndex];
        if (currentPlayer.isBot && !currentPlayer.isEliminated) {
            // Schedule fast move
            this.botTimeout = setTimeout(() => {
                this.handleTimeout();
            }, 1500); // 1.5s delay for realistic but fast play
        }

        this.timerInterval = setInterval(() => {
            if (!this.state) {
                clearInterval(this.timerInterval);
                return;
            }

            if (this.state.turnTimer <= 0) {
                clearInterval(this.timerInterval);
                this.handleTimeout();
                return;
            }

            this.updateState({ turnTimer: this.state.turnTimer - 1 });
        }, 1000);
    }

    private handleTimeout() {
        if (!this.state) return;

        const activeIdx = this.state.activePlayerIndex;
        // In local mode, force play/prediction for active player
        // (Even if it's the human player - AFK logic)

        if (this.state.phase === 'predicting') {
            // Default prediction: 0
            const result = makePrediction(this.state, activeIdx, 0);
            if (result.success && result.newState) {
                this.updateState(result.newState);
                this.checkPhaseTransition();
            }
        } else if (this.state.phase === 'playing') {
            // Play random valid card
            const player = this.state.players[activeIdx];
            const validIndices = getValidMoves(player.hand, this.state.currentTrick);

            const choice = validIndices.length > 0
                ? validIndices[Math.floor(Math.random() * validIndices.length)]
                : 0;

            const result = playCard(this.state, activeIdx, choice);
            if (result.success && result.newState) {
                this.updateState(result.newState);
                this.checkPhaseTransition();
            }
        }
    }
}

export const gameController = GameController.getInstance();
