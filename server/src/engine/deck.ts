// ============================================================
// Cinco Vidas — Deck Logic
// Create, shuffle, and deal the Spanish deck
// ============================================================

import type { Card, Suit, Rank } from './types';
import { SUIT_HIERARCHY, RANKS } from './constants';

/** Create a full 40-card Spanish deck */
export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUIT_HIERARCHY) {
        for (const rank of RANKS) {
            deck.push({
                suit: suit as Suit,
                rank: rank as Rank,
                id: `${suit}_${rank}`,
            });
        }
    }
    return deck;
}

/** Fisher-Yates shuffle (in place, returns same array) */
export function shuffleDeck(deck: Card[]): Card[] {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

/**
 * Deal cards from the deck to players.
 * Returns the dealt hands (array of arrays) and the remaining deck.
 */
export function dealCards(
    deck: Card[],
    numPlayers: number,
    cardsPerPlayer: number
): { hands: Card[][]; remaining: Card[] } {
    const deckCopy = [...deck];
    const hands: Card[][] = [];

    for (let p = 0; p < numPlayers; p++) {
        hands.push(deckCopy.splice(0, cardsPerPlayer));
    }

    return { hands, remaining: deckCopy };
}

/**
 * Create a shuffled deck and deal to all active (non-eliminated) players.
 */
export function createAndDeal(
    numActivePlayers: number,
    cardsPerPlayer: number
): Card[][] {
    const deck = shuffleDeck(createDeck());
    const { hands } = dealCards(deck, numActivePlayers, cardsPerPlayer);
    return hands;
}
