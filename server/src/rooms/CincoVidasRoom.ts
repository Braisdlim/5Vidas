import { Room, Client } from "colyseus";
import { CincoVidasState, PlayerSchema, CardSchema, PlayedCardSchema } from "../state/CincoVidasState";
import { GameState, Player, Card, PlayedCard } from "../engine/types";
import { startNewRound, makePrediction, playCard, resolveTrickState, applyScores } from "../engine/round";
import { GAME_CONFIG, PLAYER_COLORS, ANIM } from "../engine/constants";
import { getValidMoves } from "../engine/rules";

export class CincoVidasRoom extends Room<CincoVidasState> {
    // Pure logic state (authoritative)
    private logicState: GameState;
    private turnTimerInterval: NodeJS.Timeout | null = null;
    private botTimeout: NodeJS.Timeout | null = null;

    onCreate(options: any) {
        this.setState(new CincoVidasState());

        // Initialize logic state
        this.logicState = {
            phase: 'lobby',
            players: [],
            currentRound: 0,
            cardsThisRound: 0,
            dealerIndex: -1,
            activePlayerIndex: 0,
            currentTrick: [],
            trickNumber: 1,
            winnerId: null,
            turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
        };

        this.maxClients = GAME_CONFIG.MAX_PLAYERS;

        // Message Handlers
        this.onMessage("start_game", (client) => {
            if (this.logicState.players[0].id === client.sessionId) {
                this.startGame();
            }
        });

        this.onMessage("predict", (client, prediction: number) => {
            const playerIdx = this.logicState.players.findIndex(p => p.id === client.sessionId);
            if (playerIdx !== -1) {
                const result = makePrediction(this.logicState, playerIdx, prediction);
                if (result.success && result.newState) {
                    this.updateLogicState(result.newState);
                    this.checkPhaseTransition();
                }
            }
        });

        this.onMessage("play_card", (client, cardIndex: number) => {
            const playerIdx = this.logicState.players.findIndex(p => p.id === client.sessionId);
            if (playerIdx !== -1) {
                const result = playCard(this.logicState, playerIdx, cardIndex);
                if (result.success && result.newState) {
                    this.updateLogicState(result.newState);
                    this.checkPhaseTransition();
                }
            }
        });
    }

    onJoin(client: Client, options: any) {
        // Add player to logic state
        const idx = this.logicState.players.length;
        const newPlayer: Player = {
            id: client.sessionId,
            name: options.name || `Player ${idx + 1}`,
            lives: GAME_CONFIG.STARTING_LIVES,
            hand: [],
            handSize: 0,
            isEliminated: false,
            isConnected: true,
            prediction: -1,
            tricksWon: 0,
            seatIndex: idx,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
            isBot: false
        };

        // Setup dealer if first player
        if (idx === 0) {
            this.logicState.dealerIndex = 0; // Temp
        }

        this.logicState.players.push(newPlayer);
        this.syncState();
    }

    onLeave(client: Client, consented: any) {
        const player = this.logicState.players.find(p => p.id === client.sessionId);
        if (player) {
            player.isConnected = false;
            this.syncState();
            try {
                if (consented) {
                    throw new Error("consented leave");
                }
                // Allow reconnection logic if needed
            } catch (e) {
                // Remove player? Or mark disconnected?
                // For MVP, if game hasn't started, remove.
                if (this.logicState.phase === 'lobby') {
                    this.logicState.players = this.logicState.players.filter(p => p.id !== client.sessionId);
                    this.syncState();
                }
            }
        }
    }

    private startGame() {
        if (this.logicState.players.length < GAME_CONFIG.MIN_PLAYERS) return;

        // Add bots if needed? (optional, skip for now. Human only or manual add)
        // If single player test, maybe add bots?
        if (this.logicState.players.length === 1) {
            // Add 1 bot for testing
            this.addBot();
        }

        this.logicState.dealerIndex = this.logicState.players.length - 1;
        this.logicState.activePlayerIndex = 0;
        this.advanceRound();
    }

    private addBot() {
        const idx = this.logicState.players.length;
        const bot: Player = {
            id: `bot_${idx}`,
            name: `Bot ${idx}`,
            lives: GAME_CONFIG.STARTING_LIVES,
            hand: [],
            handSize: 0,
            isEliminated: false,
            isConnected: true,
            prediction: -1,
            tricksWon: 0,
            seatIndex: idx,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
            isBot: true
        };
        this.logicState.players.push(bot);
    }

    private advanceRound() {
        const updates = startNewRound(this.logicState);
        this.updateLogicState(updates);
        this.startTurnTimer();
    }

    private updateLogicState(updates: Partial<GameState>) {
        this.logicState = { ...this.logicState, ...updates };
        this.syncState();
    }

    private checkPhaseTransition() {
        if (this.logicState.phase === 'trickResolve') {
            this.clock.setTimeout(() => {
                const updates = resolveTrickState(this.logicState);
                this.updateLogicState(updates);

                if (this.logicState.phase === 'scoring') {
                    const scoreUpdates = applyScores(this.logicState);
                    this.updateLogicState(scoreUpdates);

                    // Auto-start next round after delay?
                    this.clock.setTimeout(() => {
                        if (this.logicState.phase !== 'gameOver') {
                            this.advanceRound();
                        }
                    }, 5000); // 5s scoreboard view
                } else {
                    this.startTurnTimer();
                }
            }, ANIM.POST_TRICK_PAUSE);
        } else if (this.logicState.phase === 'playing' || this.logicState.phase === 'predicting') {
            this.startTurnTimer();
        }
    }

    private startTurnTimer() {
        if (this.turnTimerInterval) clearInterval(this.turnTimerInterval);
        if (this.botTimeout) clearTimeout(this.botTimeout);

        this.updateLogicState({ turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS });

        // Bot Logic
        const activePlayer = this.logicState.players[this.logicState.activePlayerIndex];
        if (activePlayer && activePlayer.isBot && !activePlayer.isEliminated) {
            this.botTimeout = setTimeout(() => {
                this.handleBotTurn();
            }, 1500);
        }

        this.turnTimerInterval = setInterval(() => {
            if (this.logicState.turnTimer <= 0) {
                clearInterval(this.turnTimerInterval!);
                this.handleTurnTimeout();
                return;
            }
            this.logicState.turnTimer--;
            this.state.turnTimer = this.logicState.turnTimer; // Quick sync
        }, 1000);
    }

    private handleBotTurn() {
        if (this.logicState.phase === 'predicting') {
            const pred = 0; // Simple bot
            const result = makePrediction(this.logicState, this.logicState.activePlayerIndex, pred);
            if (result.newState) {
                this.updateLogicState(result.newState);
                this.checkPhaseTransition();
            }
        } else if (this.logicState.phase === 'playing') {
            const hand = this.logicState.players[this.logicState.activePlayerIndex].hand;
            const valid = getValidMoves(hand, this.logicState.currentTrick);
            const choice = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : 0;

            const result = playCard(this.logicState, this.logicState.activePlayerIndex, choice);
            if (result.newState) {
                this.updateLogicState(result.newState);
                this.checkPhaseTransition();
            }
        }
    }

    private handleTurnTimeout() {
        // Auto-play for AFK players (same as bot logic)
        this.handleBotTurn();
    }

    private syncState() {
        // Convert pure logicState to Schema state
        this.state.phase = this.logicState.phase;
        this.state.currentRound = this.logicState.currentRound;
        this.state.cardsThisRound = this.logicState.cardsThisRound;
        this.state.dealerIndex = this.logicState.dealerIndex;
        this.state.activePlayerIndex = this.logicState.activePlayerIndex;
        this.state.trickNumber = this.logicState.trickNumber;
        this.state.winnerId = this.logicState.winnerId || "";
        this.state.turnTimer = this.logicState.turnTimer;

        // Sync Players
        // Naive approach: Clear and rebuild if length differs, or update in place
        // Optimization: Update existing by index
        this.logicState.players.forEach((p, i) => {
            let pSchema = this.state.players[i];
            if (!pSchema) {
                pSchema = new PlayerSchema();
                this.state.players.push(pSchema);
            }
            pSchema.id = p.id;
            pSchema.name = p.name;
            pSchema.lives = p.lives;
            pSchema.handSize = p.handSize; // or p.hand.length
            pSchema.isEliminated = p.isEliminated;
            pSchema.isConnected = p.isConnected;
            pSchema.prediction = p.prediction;
            pSchema.tricksWon = p.tricksWon;
            pSchema.seatIndex = p.seatIndex;
            pSchema.color = p.color;
            pSchema.isBot = !!p.isBot;

            // Sync Hand (Full sync for now)
            pSchema.hand.clear();
            p.hand.forEach(c => {
                const cSchema = new CardSchema();
                cSchema.id = c.id;
                cSchema.suit = c.suit;
                cSchema.rank = c.rank;
                pSchema.hand.push(cSchema);
            });
        });

        // Remove extra players if needed
        if (this.state.players.length > this.logicState.players.length) {
            this.state.players.splice(this.logicState.players.length);
        }

        // Sync Trick
        this.state.currentTrick.clear();
        this.logicState.currentTrick.forEach(pc => {
            const pcSchema = new PlayedCardSchema();
            pcSchema.playerId = pc.playerId;
            pcSchema.card = new CardSchema();
            pcSchema.card.id = pc.card.id;
            pcSchema.card.suit = pc.card.suit;
            pcSchema.card.rank = pc.card.rank;
            this.state.currentTrick.push(pcSchema);
        });
    }
}
