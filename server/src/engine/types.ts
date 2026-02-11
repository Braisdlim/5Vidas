// ============================================================
// Cinco Vidas — Engine Types
// Pure TypeScript interfaces shared between client and server
// ============================================================

/** The four suits of the Spanish deck, ordered by hierarchy (highest first) */
export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';

/** Valid card ranks in the Spanish deck (no 8 or 9) */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

/** A single card in the deck */
export interface Card {
    suit: Suit;
    rank: Rank;
    /** Unique identifier: "oros_7", "bastos_12", etc. */
    id: string;
}

/** A card played in a trick, associated with its player */
export interface PlayedCard {
    playerId: string;
    card: Card;
}

/** Player state */
export interface Player {
    id: string;
    name: string;
    lives: number;
    hand: Card[];
    handSize: number;
    isEliminated: boolean;
    isConnected: boolean;
    /** -1 = hasn't predicted yet */
    prediction: number;
    tricksWon: number;
    /** Seat index (0-7) for table position */
    seatIndex: number;
    /** Color assigned for display */
    color: string;
    /** Is this player a bot? */
    isBot: boolean;
    /** Is this player the room host? */
    isHost?: boolean;
}

/** Game phase / state machine states */
export type GamePhase =
    | 'lobby'
    | 'dealing'
    | 'predicting'
    | 'playing'
    | 'trickResolve'
    | 'scoring'
    | 'gameOver';

/** Full game state */
export interface GameState {
    phase: GamePhase;
    players: Player[];
    currentRound: number;
    cardsThisRound: number;
    dealerIndex: number;
    activePlayerIndex: number;
    currentTrick: PlayedCard[];
    trickNumber: number;
    winnerId: string | null;
    turnTimer: number;
}

/** Round result for scoreboard */
export interface RoundResult {
    playerId: string;
    playerName: string;
    prediction: number;
    tricksWon: number;
    difference: number;
    livesLost: number;
    livesRemaining: number;
    eliminated: boolean;
}
