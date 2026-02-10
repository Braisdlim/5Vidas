// ============================================================
// Cinco Vidas — Engine Constants
// All game constants: hierarchies, suits, card cycle, colors
// ============================================================

import type { Suit, Rank } from './types';

/** Suits ordered by hierarchy (highest first): Oros > Copas > Espadas > Bastos */
export const SUIT_HIERARCHY: readonly Suit[] = ['oros', 'copas', 'espadas', 'bastos'] as const;

/** Suit display names */
export const SUIT_NAMES: Record<Suit, string> = {
    oros: 'Oros',
    copas: 'Copas',
    espadas: 'Espadas',
    bastos: 'Bastos',
};

/** All valid ranks in ascending order */
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

/** Rank display names (for figure cards) */
export const RANK_NAMES: Record<number, string> = {
    1: 'As',
    10: 'Sota',
    11: 'Caballo',
    12: 'Rey',
};

/** Card dealing cycle: 5 → 4 → 3 → 2 → 1 → 5 → ... */
export const CARDS_PER_ROUND_CYCLE = [5, 4, 3, 2, 1] as const;

/** Game configuration */
export const GAME_CONFIG = {
    /** Starting lives per player */
    STARTING_LIVES: 5,
    /** Minimum number of players */
    MIN_PLAYERS: 2,
    /** Maximum number of players */
    MAX_PLAYERS: 8,
    /** Total cards in the deck */
    TOTAL_CARDS: 40,
    /** Turn timer in seconds */
    TURN_TIMER_SECONDS: 15,
    /** Reconnection grace period in seconds */
    RECONNECTION_TIMEOUT: 30,
    /** Room code character set (no I/O to avoid confusion) */
    ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    /** Room code length */
    ROOM_CODE_LENGTH: 4,
} as const;

/** Player colors for the table (up to 8) */
export const PLAYER_COLORS = [
    '#E6B800', // Gold
    '#4FC3F7', // Light blue
    '#EF5350', // Red
    '#66BB6A', // Green
    '#AB47BC', // Purple
    '#FF7043', // Orange
    '#26C6DA', // Cyan
    '#EC407A', // Pink
] as const;

/** Phaser game dimensions (portrait mobile-first) */
export const GAME_DIMENSIONS = {
    WIDTH: 390,
    HEIGHT: 844,
} as const;

/** Animation timings in milliseconds */
export const ANIM = {
    DEAL_PER_CARD: 200,
    DEAL_STAGGER: 100,
    CARD_TO_CENTER: 350,
    TRICK_HIGHLIGHT: 800,
    CARDS_TO_WINNER: 400,
    CARD_FLIP: 300,
    CARD_SELECT: 150,
    LIFE_LOSS: 500,
    ELIMINATION: 600,
    VICTORY_CONFETTI: 2000,
    ROUND_TRANSITION: 500,
    POST_TRICK_PAUSE: 1500,
    BETWEEN_PLAYS_PAUSE: 100,
} as const;
