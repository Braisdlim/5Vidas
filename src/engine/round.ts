// ============================================================
// Cinco Vidas — Round Logic
// Pure functional logic for state transitions
// ============================================================

import type { GameState, PlayedCard } from './types';
import {
    createAndDeal
} from './deck';
import {
    getCardsForRound,
    getNextActivePlayerIndex,
    getPredictionOrder,
    resolveTrick,
    calculateLivesLost,
    resolveSimultaneousEliminations,
    validatePrediction
} from './rules';
import { GAME_CONFIG } from './constants';

/**
 * Start a new round:
 * 1. Increment round number
 * 2. Calculate cards to deal
 * 3. Rotate dealer
 * 4. Deal cards
 * 5. Set phase to 'predicting'
 */
export function startNewRound(state: GameState): Partial<GameState> {
    const nextRound = state.currentRound + 1;
    const cardsThisRound = getCardsForRound(nextRound);

    // Rotate dealer (next active player)
    const nextDealerIdx = getNextActivePlayerIndex(state.dealerIndex, state.players);

    // Active player for prediction is next to dealer
    const firstPredictorIdx = getNextActivePlayerIndex(nextDealerIdx, state.players);

    // Filter active players for dealing
    const activePlayers = state.players.filter(p => !p.isEliminated);
    const hands = createAndDeal(activePlayers.length, cardsThisRound);

    // Assign hands to active players
    let handIdx = 0;
    const updatedPlayers = state.players.map(p => {
        if (p.isEliminated) return p;
        const hand = hands[handIdx++];
        return {
            ...p,
            hand,
            handSize: hand.length,
            prediction: -1, // Reset prediction
            tricksWon: 0    // Reset tricks
        };
    });

    return {
        phase: 'predicting',
        currentRound: nextRound,
        cardsThisRound,
        dealerIndex: nextDealerIdx,
        activePlayerIndex: firstPredictorIdx,
        players: updatedPlayers,
        currentTrick: [],
        trickNumber: 1,
        winnerId: null,
        turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
    };
}

/**
 * Process a player's prediction
 */
export function makePrediction(
    state: GameState,
    playerIndex: number,
    prediction: number
): { success: boolean; newState?: Partial<GameState>; error?: string } {
    const player = state.players[playerIndex];

    if (state.phase !== 'predicting') return { success: false, error: 'Not in predicting phase' };
    if (state.activePlayerIndex !== playerIndex) return { success: false, error: 'Not your turn' };

    // Validate
    const currentSum = state.players.reduce((sum, p) => sum + (p.prediction >= 0 ? p.prediction : 0), 0);
    const isDealer = playerIndex === state.dealerIndex;

    const validation = validatePrediction(prediction, state.cardsThisRound, isDealer, currentSum);
    if (!validation.valid) return { success: false, error: validation.reason };

    // Update player
    const updatedPlayers = [...state.players];
    updatedPlayers[playerIndex] = { ...player, prediction };

    // Check if this was the last player
    const predictionOrder = getPredictionOrder(state.dealerIndex, state.players);
    const isLast = playerIndex === predictionOrder[predictionOrder.length - 1];

    if (isLast) {
        // Transition to playing Phase
        // First player to play is same as first predictor (right of dealer)
        const firstPlayerIdx = getNextActivePlayerIndex(state.dealerIndex, state.players);

        return {
            success: true,
            newState: {
                players: updatedPlayers,
                phase: 'playing',
                activePlayerIndex: firstPlayerIdx,
                turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
            }
        };
    } else {
        // Next predictor
        const nextIdx = getNextActivePlayerIndex(playerIndex, state.players);
        return {
            success: true,
            newState: {
                players: updatedPlayers,
                activePlayerIndex: nextIdx,
                turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
            }
        };
    }
}

/**
 * Play a card
 */
export function playCard(
    state: GameState,
    playerIndex: number,
    cardIndex: number
): { success: boolean; newState?: Partial<GameState>; error?: string } {
    const player = state.players[playerIndex];

    if (state.phase !== 'playing') return { success: false, error: 'Not in playing phase' };
    if (state.activePlayerIndex !== playerIndex) return { success: false, error: 'Not your turn' };
    if (cardIndex < 0 || cardIndex >= player.hand.length) return { success: false, error: 'Invalid card index' };

    const card = player.hand[cardIndex];

    // Rule: No suit restriction. User explicitly stated "No hay que asistir al palo".
    // So any card played is valid logic-wise (as long as index is valid).

    // Remove card from hand
    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);

    const updatedPlayers = [...state.players];
    updatedPlayers[playerIndex] = {
        ...player,
        hand: newHand,
        handSize: newHand.length
    };

    const playedCard: PlayedCard = { playerId: player.id, card };
    const newTrick = [...state.currentTrick, playedCard];

    // Check if trick is complete
    const activePlayersCount = state.players.filter(p => !p.isEliminated).length;
    const isTrickComplete = newTrick.length === activePlayersCount;

    if (isTrickComplete) {
        return {
            success: true,
            newState: {
                players: updatedPlayers,
                currentTrick: newTrick,
                phase: 'trickResolve', // Brief pause state
                activePlayerIndex: -1, // No one moves during resolve
                turnTimer: 0
            }
        };
    } else {
        const nextIdx = getNextActivePlayerIndex(playerIndex, state.players);
        return {
            success: true,
            newState: {
                players: updatedPlayers,
                currentTrick: newTrick,
                activePlayerIndex: nextIdx,
                turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
            }
        };
    }
}

/**
 * Resolve trick (after animation pause)
 */
export function resolveTrickState(state: GameState): Partial<GameState> {
    const winnerPlayedCard = resolveTrick(state.currentTrick);
    const winnerId = winnerPlayedCard.playerId;
    const winnerIndex = state.players.findIndex(p => p.id === winnerId);

    const updatedPlayers = [...state.players];
    updatedPlayers[winnerIndex].tricksWon += 1;

    // Check if round is over (no cards left in hand for anyone)
    // Actually, check trick number vs cardsThisRound
    const isRoundOver = state.trickNumber === state.cardsThisRound;

    if (isRoundOver) {
        return {
            players: updatedPlayers,
            currentTrick: [],
            phase: 'scoring',
            winnerId: null // winnerId in state is for GAME winner, not trick
        };
    }

    return {
        players: updatedPlayers,
        currentTrick: [], // Clear trick
        trickNumber: state.trickNumber + 1,
        phase: 'playing',
        activePlayerIndex: winnerIndex, // Winner leads next trick
        turnTimer: GAME_CONFIG.TURN_TIMER_SECONDS
    };
}

/**
 * Apply scores and handle eliminations
 */
export function applyScores(state: GameState): Partial<GameState> {
    const survivors: { index: number, lives: number }[] = [];

    const updatedPlayers = state.players.map((p, index) => {
        if (p.isEliminated) return p;

        const lost = calculateLivesLost(p.prediction, p.tricksWon);
        const newLives = p.lives - lost;

        survivors.push({ index, lives: newLives });

        return {
            ...p,
            lives: newLives
        };
    });

    // Check eliminations
    const eliminatedIndices = resolveSimultaneousEliminations(survivors);

    eliminatedIndices.forEach(idx => {
        updatedPlayers[idx].isEliminated = true;
    });

    const activeCount = updatedPlayers.filter(p => !p.isEliminated).length;

    if (activeCount <= 1) {
        // Game Over
        const winner = updatedPlayers.find(p => !p.isEliminated);
        return {
            players: updatedPlayers,
            phase: 'gameOver',
            winnerId: winner ? winner.id : null // Could be null if draw (all dead)
        };
    }

    // Ready for next round (but return to 'scoring' phase so UI can show scoreboard)
    // The startNewRound() will be called when user clicks "Continue"
    return {
        players: updatedPlayers,
        phase: 'scoring'
    };
}
