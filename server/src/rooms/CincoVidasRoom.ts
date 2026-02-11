import { Room, Client } from "colyseus";
import { CincoVidasState, PlayerSchema, CardSchema, PlayedCardSchema } from "../state/CincoVidasState";
import { GameState, Player, Card, PlayedCard } from "../engine/types";
import { startNewRound, makePrediction, playCard, resolveTrickState, applyScores } from "../engine/round";
import { GAME_CONFIG, PLAYER_COLORS, ANIM } from "../engine/constants";
import { getValidMoves, getNextActivePlayerIndex } from "../engine/rules";

export class CincoVidasRoom extends Room<CincoVidasState> {
    // Pure logic state (authoritative)
    private logicState: GameState;
    private turnTimerInterval: NodeJS.Timeout | null = null;
    private botTimeout: NodeJS.Timeout | null = null;

    onCreate(options: any) {
        // Generate random 4-char Room Code (A-Z, 0-9)
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.roomId = result;
        // console.log("Room Created:", this.roomId);

        // Backup in metadata for debugging/display if roomId fails to set
        this.setMetadata({ roomCode: result });

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

        this.maxClients = options.maxClients || GAME_CONFIG.MAX_PLAYERS;
        if (this.maxClients < 2) this.maxClients = 2;
        if (this.maxClients > 8) this.maxClients = 8;

        // Message Handlers
        this.onMessage("start_game", (client) => {
            const player = this.logicState.players.find(p => p.id === client.sessionId);
            if (player && player.isHost) {
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

        this.onMessage("surrender", (client) => {
            const playerIdx = this.logicState.players.findIndex(p => p.id === client.sessionId);
            const player = this.logicState.players[playerIdx];

            if (player) {
                if (this.logicState.phase === 'lobby') {
                    // In lobby, surrender = leave
                    this.removePlayer(client.sessionId);
                    return;
                }

                if (!player.isEliminated) {
                    // Eliminar
                    player.lives = 0;
                    player.isEliminated = true;

                    // Clear hand (return cards to "deck" logic)
                    player.hand = [];
                    player.handSize = 0;

                    // Host Migration if needed
                    if (player.isHost) {
                        player.isHost = false;
                        const nextHost = this.logicState.players.find(p =>
                            p.id !== client.sessionId && !p.isBot && p.isConnected && !p.isEliminated
                        );
                        if (nextHost) nextHost.isHost = true;
                    }

                    // Check Instant Win (only 1 survivor)
                    const survivors = this.logicState.players.filter(p => !p.isEliminated);
                    if (survivors.length === 1) {
                        this.updateLogicState({
                            phase: 'gameOver',
                            winnerId: survivors[0].id
                        });
                    } else if (this.logicState.activePlayerIndex === playerIdx) {
                        // If it was their turn, advance to next
                        const nextIdx = getNextActivePlayerIndex(playerIdx, this.logicState.players);
                        this.logicState.activePlayerIndex = nextIdx;
                        // Restart timer / check phase
                        this.checkPhaseTransition();
                    }

                    this.syncState();
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
            isBot: false,
            // First player is Host
            isHost: this.logicState.players.length === 0
        };

        // Setup dealer if first player
        if (idx === 0) {
            this.logicState.dealerIndex = 0; // Temp
        }

        this.logicState.players.push(newPlayer);
        this.syncState();
    }

    async onLeave(client: Client, consented: boolean) {
        const player = this.logicState.players.find(p => p.id === client.sessionId);
        if (!player) return;

        // 1. Handle Host Migration IMMEDIATELY (so lobby doesn't freeze)
        if (player.isHost) {
            player.isHost = false;
            // Find next available host (human, connected, not self)
            // We prioritize connected players.
            const nextHost = this.logicState.players.find(p =>
                p.id !== client.sessionId && !p.isBot && p.isConnected
            );
            if (nextHost) {
                nextHost.isHost = true;
            } else {
                // If no one is connected, maybe the first in list (ghost host)?
                // Better to wait. If everyone disconnects, room dies.
                // If only bots remain, room dies eventually.
                const potentialHost = this.logicState.players.find(p => p.id !== client.sessionId && !p.isBot);
                if (potentialHost) potentialHost.isHost = true;
            }
            this.syncState();
        }

        // 2. Consented Leave (User clicked "Quit") -> Remove immediately
        if (consented) {
            this.removePlayer(client.sessionId);
            return;
        }

        // 3. Unconsented (Network/Tab close) -> Wait for Reconnection
        player.isConnected = false;
        this.syncState();

        try {
            // Allow 60 seconds to reconnect
            await this.allowReconnection(client, 60);

            // Success!
            const reconnectedPlayer = this.logicState.players.find(p => p.id === client.sessionId);
            if (reconnectedPlayer) {
                reconnectedPlayer.isConnected = true;

                // If they were host and we migrated it away... strictly speaking we gave it away.
                // They rejoin as normal player.
                // Unless they are the ONLY human?
                this.syncState();
            }

        } catch (e) {
            // Timeout -> Remove completely
            this.removePlayer(client.sessionId);
        }
    }

    private removePlayer(sessionId: string) {
        if (this.logicState.phase === 'lobby') {
            this.logicState.players = this.logicState.players.filter(p => p.id !== sessionId);
        } else {
            // In Game: Mark as permanently disconnected / eliminated?
            // For now, keep as disconnected. Game logic handles skipping them.
            // Or remove if we want to support dynamic drop-out?
            // 5 Vidas usually requires fixed players.
            // We just leave isConnected = false.
            const p = this.logicState.players.find(p => p.id === sessionId);
            if (p) p.isConnected = false;
        }
        this.syncState();
    }

    private startGame() {
        if (this.logicState.players.length < 2) return; // Min 2 players for any game

        // Add bots if needed? (optional, skip for now. Human only or manual add)
        // If single player test, maybe add bots?
        if (this.logicState.players.length === 1) {
            // Add 1 bot for testing
            this.addBot();
        }

        // Lock the room to prevent new players from joining
        this.lock();

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
            pSchema.isHost = !!p.isHost;

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
