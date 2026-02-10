// ============================================================
// Cinco Vidas — Game Rules
// Pure functions for card comparison, trick resolution, prediction validation
// ============================================================

import type { Card, PlayedCard } from './types';
import { SUIT_HIERARCHY, RANKS } from './constants';

/**
 * Compare two cards. Returns positive if a > b, negative if a < b, 0 if equal.
 * Rank takes priority, then suit hierarchy for tiebreaker.
 */
export function compareCards(a: Card, b: Card): number {
    const rankIndexA = RANKS.indexOf(a.rank);
    const rankIndexB = RANKS.indexOf(b.rank);

    if (rankIndexA !== rankIndexB) {
        return rankIndexA - rankIndexB;
    }

    // Same rank → suit hierarchy (lower index = better suit)
    const suitIndexA = SUIT_HIERARCHY.indexOf(a.suit);
    const suitIndexB = SUIT_HIERARCHY.indexOf(b.suit);
    return suitIndexB - suitIndexA; // Reversed: lower index = stronger
}

/**
 * Resolve a trick: determine the winning PlayedCard.
 * The card with the highest rank wins. Ties broken by suit hierarchy.
 */
export function resolveTrick(trick: PlayedCard[]): PlayedCard {
    if (trick.length === 0) {
        throw new Error('Cannot resolve an empty trick');
    }

    let winner = trick[0];
    for (let i = 1; i < trick.length; i++) {
        if (compareCards(trick[i].card, winner.card) > 0) {
            winner = trick[i];
        }
    }
    return winner;
}

/**
 * Calculate how many cards to deal this round.
 * Cycle: 5 → 4 → 3 → 2 → 1 → 5 → ...
 */
export function getCardsForRound(roundNumber: number): number {
    const cycle = [5, 4, 3, 2, 1];
    return cycle[(roundNumber - 1) % cycle.length];
}

/**
 * Validate a prediction.
 * Rules:
 * 1. prediction must be >= 0 and <= cardsThisRound
 * 2. If this is the LAST predictor (dealer), the sum of all predictions
 *    cannot equal the number of cards dealt.
 *
 * Returns { valid: boolean, reason?: string }
 */
export function validatePrediction(
    prediction: number,
    cardsThisRound: number,
    isDealer: boolean,
    currentPredictionSum: number
): { valid: boolean; reason?: string } {
    if (prediction < 0) {
        return { valid: false, reason: 'La predicción no puede ser negativa' };
    }

    if (prediction > cardsThisRound) {
        return { valid: false, reason: `No puedes predecir más de ${cardsThisRound} bazas` };
    }

    if (isDealer) {
        const wouldBeSum = currentPredictionSum + prediction;
        if (wouldBeSum === cardsThisRound) {
            return {
                valid: false,
                reason: `La suma total no puede ser ${cardsThisRound}. No puedes decir ${prediction}`,
            };
        }
    }

    return { valid: true };
}

/**
 * Get the forbidden prediction value for the dealer (if any).
 * Returns the number the dealer cannot say, or -1 if all values are allowed.
 */
export function getDealerForbiddenPrediction(
    cardsThisRound: number,
    currentPredictionSum: number
): number {
    const forbidden = cardsThisRound - currentPredictionSum;
    if (forbidden >= 0 && forbidden <= cardsThisRound) {
        return forbidden;
    }
    return -1; // All values allowed (shouldn't happen with valid game state)
}

/**
 * Calculate lives lost for a player this round.
 * lives_lost = |prediction - tricksWon|
 */
export function calculateLivesLost(prediction: number, tricksWon: number): number {
    return Math.abs(prediction - tricksWon);
}

/**
 * Get the next active player index (skipping eliminated players).
 * Direction: to the right (incrementing index, wrapping around).
 */
export function getNextActivePlayerIndex(
    currentIndex: number,
    players: { isEliminated: boolean }[],
    direction: 1 | -1 = 1
): number {
    const n = players.length;
    let next = (currentIndex + direction + n) % n;
    let safety = 0;

    while (players[next].isEliminated && safety < n) {
        next = (next + direction + n) % n;
        safety++;
    }

    return next;
}

/**
 * Get the player order for predictions (starting from dealer's right, ending with dealer).
 * Returns array of player indices.
 */
export function getPredictionOrder(
    dealerIndex: number,
    players: { isEliminated: boolean }[]
): number[] {
    const order: number[] = [];
    let current = getNextActivePlayerIndex(dealerIndex, players, 1); // Start right of dealer

    while (current !== dealerIndex) {
        if (!players[current].isEliminated) {
            order.push(current);
        }
        current = getNextActivePlayerIndex(current, players, 1);
    }

    // Dealer predicts last
    order.push(dealerIndex);
    return order;
}

/**
 * Get the play order for tricks (same as prediction order: right of dealer first, fixed).
 * Returns array of player indices.
 */
export function getPlayOrder(
    dealerIndex: number,
    players: { isEliminated: boolean }[]
): number[] {
    return getPredictionOrder(dealerIndex, players);
}

/**
 * Get valid card indices a player can play.
 * Rule: Any card is valid (no need to follow suit).
 */
export function getValidMoves(hand: Card[], _currentTrick: PlayedCard[]): number[] {
    // No restrictions in this game variant
    return hand.map((_, i) => i);
}

/**
 * Resolve simultaneous eliminations.
 * If multiple players reach <= 0 lives, only the one(s) with the MOST lives survive.
 * Returns indices of players who should be eliminated.
 */
export function resolveSimultaneousEliminations(
    playersWithNewLives: { index: number; lives: number }[]
): number[] {
    const atOrBelowZero = playersWithNewLives.filter(p => p.lives <= 0);

    if (atOrBelowZero.length <= 1) {
        return atOrBelowZero.map(p => p.index);
    }

    // Multiple at/below zero: the one with MOST lives (least negative) survives
    const maxLives = Math.max(...atOrBelowZero.map(p => p.lives));
    const survivors = atOrBelowZero.filter(p => p.lives === maxLives);

    if (survivors.length === atOrBelowZero.length) {
        // ALL have the same value → all eliminated (special draw case if all at 0)
        return atOrBelowZero.map(p => p.index);
    }

    // Eliminate everyone except the survivor(s)
    return atOrBelowZero
        .filter(p => p.lives !== maxLives)
        .map(p => p.index);
}
