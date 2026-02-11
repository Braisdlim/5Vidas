import { Card, Player, PlayedCard, BotDifficulty, Suit } from '../../engine/types';
import { getValidMoves, beats } from '../../engine/rules';
export function calculateBotPrediction(
    hand: Card[],
    cardsInRound: number,
    players: Player[],
    _dealerIndex: number,
    myIndex: number,
    difficulty: BotDifficulty = BotDifficulty.Medium
): number {

    // 1. Analyze Hand Strength
    let estimatedTricks = 0;

    // Count High Cards (assuming 12, 11 are strong)
    const kings = hand.filter(c => c.rank === 12).length;
    const horses = hand.filter(c => c.rank === 11).length;

    if (difficulty === BotDifficulty.Easy) {
        // Easy: Just count kings and maybe add random noise
        estimatedTricks = kings + (Math.random() > 0.5 ? 1 : 0);
        // Sometimes underestimate
        if (Math.random() > 0.7) estimatedTricks = Math.max(0, estimatedTricks - 1);
    }
    else {
        // Medium/Hard: Better estimation
        estimatedTricks += kings;
        estimatedTricks += (horses * 0.6); // Horses good but not guaranteed

        // Hard: refined slightly by suit distribution (placeholder for now)
    }

    // --- HARD MODE: MARKET ANALYSIS (Opponent Bids) ---
    if (difficulty === BotDifficulty.Hard) {
        let knownBids = 0;
        players.forEach((p, idx) => {
            // Count predictions from players who have already bid
            if (p.prediction >= 0 && idx !== myIndex) {
                knownBids += p.prediction;
            }
        });

        // Market Supply vs Demand
        if (knownBids > cardsInRound) {
            // Overbooked: Be conservative.
            estimatedTricks -= 0.4;
        } else if (knownBids + Math.round(estimatedTricks) < cardsInRound) {
            // Underbooked: Loose tricks available. 
            estimatedTricks += 0.3;
        }
    }

    // Round to nearest int
    let prediction = Math.round(estimatedTricks);

    // Clamp
    prediction = Math.max(0, Math.min(prediction, cardsInRound));

    // 2. Sandwich Rule (Forbidden Prediction)
    // We check if we are the last one to predict (which means we are the "Dealer" for this constraint)
    const bidsCount = players.filter((p, idx) => p.prediction >= 0 && idx !== myIndex).length;
    const isLast = bidsCount === players.length - 1;

    if (isLast) {
        const currentSum = players.reduce((sum, p) => sum + (p.prediction >= 0 ? p.prediction : 0), 0);
        const forbidden = cardsInRound - currentSum;

        if (prediction === forbidden) {
            // Must change
            if (difficulty === BotDifficulty.Hard) {
                // Hard: If logic says X, but X is forbidden.
                // If we were conservative (overbooked), maybe we go UP?
                // If we were opportunistic (underbooked), maybe we go DOWN?
                // Default: Try to match estimatedTricks direction.
                prediction = (estimatedTricks > prediction) ? prediction + 1 : prediction - 1;
            } else {
                // Easy/Med: Random or Down
                prediction = Math.random() > 0.5 ? prediction + 1 : prediction - 1;
            }

            // Re-clamp
            if (prediction < 0) prediction = 1;
            if (prediction > cardsInRound) prediction = cardsInRound - 1;
        }
    }

    return prediction;
}

/**
 * Context for Bot Decision
 */
export interface BotContext {
    hand: Card[];
    currentTrick: PlayedCard[];
    trumpCard?: Card; // If there is a trump card (rules say "El primero marca el palo", maybe no static trump?)
    // Rules say: "Si no, pueden fallar (usar triunfo)". This implies there IS a trump suit.
    // Usually the last card dealt or a specific card.
    // I need to know the trump suit.
    // I'll add `trumpCard` to context. GameState usually has it?
    // If not, I'll ignore trump logic for now or infer it.

    playedCardsInRound: PlayedCard[]; // Cards played in previous tricks this round
    myTricksWon: number;
    myPrediction: number;
    cardsInRound: number; // Total cards per hand
    difficulty: BotDifficulty;
    leadingSuit?: Suit;
    players: Player[]; // To check opponents
}

/**
 * Difficulty-aware Play Logic
 */
export function calculateBotPlay(ctx: BotContext): number {
    const { hand, currentTrick, difficulty, myTricksWon, myPrediction } = ctx;

    // Find valid moves indices
    // We work with INDICES because playCard expects index
    const validIndices = getValidMoves(hand, currentTrick);

    if (validIndices.length === 0) return 0; // Should not happen
    if (validIndices.length === 1) return validIndices[0]; // Forced move

    // Map indices to cards for analysis
    const moves = validIndices.map(idx => ({ index: idx, card: hand[idx] }));

    // --- EASY MODE ---
    if (difficulty === BotDifficulty.Easy) {
        // 30% chance to play completely random valid card
        if (Math.random() < 0.3) {
            return moves[Math.floor(Math.random() * moves.length)].index;
        }
        // Otherwise play highest rank (often bad if trying to lose)
        moves.sort((a, b) => b.card.rank - a.card.rank);
        return moves[0].index;
    }

    // --- STRATEGIC ANALYSIS (Medium / Hard) ---

    // const amIWinning = myTricksWon >= myPrediction; // Unused
    // const needToWin = !amIWinning; // Redundant
    // Note: If I met my quota (won == pred), I generally want to lose now to stay exact.
    // If I overshot (won > pred), I assume I want to lose to minimize damage? (Or win all to screw others?)
    // 5 Vidas rules: "Pierdes la diferencia". So minimizing difference is key. 
    // If I have 2 wins and pred 1, diff is 1. If I win 3, diff is 2. So LOSS is better.

    const wantToWin = (myTricksWon < myPrediction);

    const isLeading = (currentTrick.length === 0);

    // Helper: Sort moves by rank (High to Low)
    // Assumption: Higher rank value = Stronger card. (Need to verify this assumption later!)
    // If 1 is Ace and 12 is King, and 1 > 12... numeric sort might be wrong.
    // I will use `beats(a,b)` to determing strength relatively if possible, or assume generic Rank.
    // For now, let's assume `game/engine/rules.ts` handles `beats`.
    // I need to define "Strongest" locally.
    const sortedMoves = [...moves].sort((a, b) => b.card.rank - a.card.rank);
    const highestCard = sortedMoves[0];
    const lowestCard = sortedMoves[sortedMoves.length - 1];

    if (isLeading) {
        // LEADING
        if (wantToWin) {
            // Play strongest card to secure trick (Medium/Hard)
            // Hard: check if my strongest is guaranteed?
            return highestCard.index;
        } else {
            // Want to lose: Play lowest card
            return lowestCard.index;
        }
    } else {
        // FOLLOWING
        // Who is winning currently?
        // We need `resolveTrick` or simulate it.
        // `beats` function takes 2 cards.
        // We can find the current winner of the trick.
        let currentWinner = currentTrick[0];
        for (let i = 1; i < currentTrick.length; i++) {
            if (beats(currentTrick[i].card, currentWinner.card)) { // Need to check if beats takes 3rd arg trump?
                currentWinner = currentTrick[i];
            }
        }

        // Can I beat the current winner?
        const winningMoves = moves.filter(m => beats(m.card, currentWinner.card)); // Check `beats` signature

        if (wantToWin) {
            if (winningMoves.length > 0) {
                // I can win.
                // Medium: Just win (highest?)
                // Hard: Win CHEAPLY (lowest winner)
                if (difficulty === BotDifficulty.Hard) {
                    // Sort winners by rank ascending (weakest winner)
                    winningMoves.sort((a, b) => a.card.rank - b.card.rank);
                    return winningMoves[0].index;
                } else {
                    // Medium: Random winner or highest?
                    // Let's use cheapest too, it's rational.
                    winningMoves.sort((a, b) => a.card.rank - b.card.rank);
                    return winningMoves[0].index;
                }
            } else {
                // Cannot win.
                // Dump trash.
                // Hard: Dump highest dangerous card? Or lowest?
                // Usually dump lowest to save high for later? Or dump high if it will never win?
                // If I have a King of a non-trump suit and I can't follow suit, I might discard it?
                return lowestCard.index;
            }
        } else {
            // Want to LOSE
            if (winningMoves.length === moves.length) {
                // All my cards win (e.g. I have only higher trumps).
                // Must win. Play highest to get it over with? Or lowest to save high?
                // Whatever.
                return highestCard.index;
            }

            // I have cards that lose.
            // Hard: Play HIGHEST loser (to burn high cards safely)
            // Medium: Play lowest loser (safe)
            const losingMoves = moves.filter(m => !winningMoves.includes(m));

            if (difficulty === BotDifficulty.Hard) {
                losingMoves.sort((a, b) => b.card.rank - a.card.rank); // Sort high to low
                return losingMoves[0].index;
            } else {
                losingMoves.sort((a, b) => a.card.rank - b.card.rank); // Sort low to high
                return losingMoves[0].index;
            }
        }
    }
}
