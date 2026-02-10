import { create } from 'zustand';
import type { GameState, Player } from '../engine/types';

interface GameStore {
    gameState: GameState | null;
    myPlayerId: string | null;

    // Actions
    setGameState: (state: GameState) => void;
    setMyPlayerId: (id: string) => void;
    reset: () => void;

    // Computed helpers
    getMyPlayer: () => Player | undefined;
    isMyTurn: () => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
    gameState: null,
    myPlayerId: null,

    setGameState: (state) => set({ gameState: state }),
    setMyPlayerId: (id) => set({ myPlayerId: id }),
    reset: () => set({ gameState: null, myPlayerId: null }),

    getMyPlayer: () => {
        const { gameState, myPlayerId } = get();
        return gameState?.players.find(p => p.id === myPlayerId);
    },

    isMyTurn: () => {
        const { gameState, myPlayerId } = get();
        if (!gameState || !myPlayerId) return false;

        const activePlayer = gameState.players[gameState.activePlayerIndex];
        return activePlayer?.id === myPlayerId;
    }
}));
