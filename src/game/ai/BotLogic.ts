import type { Card, GameState, Player, PlayedCard } from '../../engine/types';

/**
 * Calculates a reasonable prediction for a bot based on its hand.
 */
export function calculateBotPrediction(
    hand: Card[],
    cardsInRound: number,
    players: Player[],
    dealerIndex: number,
    myIndex: number
): number {
    // 1. Analyze Hand Strength
    let estimatedTricks = 0;

    // Count "Master" cards (Kings, Horses) - Very likely to win
    const kings = hand.filter(c => c.rank === 12).length;
    const horses = hand.filter(c => c.rank === 11).length;
    const sotas = hand.filter(c => c.rank === 10).length;

    // High cards (7s)
    // const sevens = hand.filter(c => c.rank === 7).length;

    // Heuristic:
    // Kings are almost guaranteed tricks in 5-card rounds, less so in 1-card rounds?
    // Actually, in 1-card round, King is 100% win unless someone has a better King (by suit).
    // But suit order checks are complex.

    // Simple logic:
    estimatedTricks += kings;

    // Horses are strong, but can be beaten by Kings. 
    // If I have 11, chance to win is high.
    if (cardsInRound <= 3) {
        estimatedTricks += horses;
    } else {
        // In larger hands, horses might be cut. Count 50%.
        estimatedTricks += (horses * 0.5);
    }

    // Sotas and 7s
    estimatedTricks += (sotas * 0.25);

    // Round to nearest int
    let prediction = Math.round(estimatedTricks);

    // Cap at hand size
    prediction = Math.min(prediction, cardsInRound);
    // Floor at 0
    prediction = Math.max(0, prediction);

    // 2. Adjust for "Sandwich Rule" (Forbidden prediction)
    // If I am the last player (Dealer), I must check the sum.

    // Find who is the dealer.
    // In our state, dealerIndex is the dealer.
    const isDealer = (myIndex === dealerIndex);

    if (isDealer) {
        const currentSum = players.reduce((sum, p) => sum + (p.prediction >= 0 ? p.prediction : 0), 0);
        const forbidden = cardsInRound - currentSum;

        if (prediction === forbidden) {
            // Must change.
            // Improve or decrease?
            // If I have specific high cards, I probably want to increase if possible (riskier but maybe I win).
            // Or decrease (safe).
            // Default: decrease unless 0, then increase.
            if (prediction > 0) {
                prediction--;
            } else {
                prediction++;
            }
        }
    }

    return prediction;
}

/**
 * Calculates which card to play.
 */
export function calculateBotPlay(
    hand: Card[],
    currentTrick: PlayedCard[],
    validindices: number[] // Indices in hand
): number {
    if (validindices.length === 0) return 0;
    if (validindices.length === 1) return validindices[0];

    // Helper: Get card object from index
    const getCard = (idx: number) => hand[idx];

    // 1. Am I leading? (Trick empty)
    if (currentTrick.length === 0) {
        // Strategy: 
        // If I want to win tricks (prediction > tricksWon), play high.
        // If I want to lose (prediction <= tricksWon), play low.
        // const myPlayer = gameState.players.find(p => p.hand === hand); 
        // Better: Pass myPlayer explicitly.
        // Assuming simple heuristic for now.

        // Let's just play a random high card if we have one, or random low.
        // For simplicity: Play highest card to try to control the game.
        // Or play lowest to save highs?
        // Let's just pick highest rank.
        return validindices.sort((a, b) => getCard(b).rank - getCard(a).rank)[0];
    }

    // 2. Following
    // Calculate current winner of trick
    // const currentWinner = resolveTrick(currentTrick);
    // (Logic to beat it?)
    // This is complex. 

    // Simple Bot: Random valid move is what we had.
    // Slightly better: Play highest card if it beats current high, otherwise lowest.

    // Since we don't have detailed "Player" object passed here easily without refactor,
    // let's stick to a robust simple strategy:
    // "Try to win if I have a very strong card, otherwise dump garbage"

    // Sort valid moves by rank desc
    const moves = validindices.map(idx => ({ idx, card: getCard(idx) }));
    moves.sort((a, b) => b.card.rank - a.card.rank); // Descending

    // Play highest
    return moves[0].idx;
}
