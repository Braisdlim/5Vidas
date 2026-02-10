import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { GameHUD } from './components/GameHUD';
import { gameController } from './game/GameController';
import { multiplayer } from './network/MultiplayerClient';

import { audioManager } from './engine/AudioManager';

type GameScreen = 'menu' | 'game';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [screen, setScreen] = useState<GameScreen>('menu');
    const [playerName, setPlayerName] = useState(() => {
        try {
            const stored = localStorage.getItem('cinco-vidas-player');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.name || '';
            }
        } catch { /* ignore */ }
        return '';
    });

    const handleStartGame = () => {
        // Local Play
        const playerId = getOrCreatePlayerId();
        // Init controller
        gameController.init(playerId);
        gameController.setOnlineMode(false);
        gameController.startGame([playerName || 'Jugador', 'Bot 1', 'Bot 2', 'Bot 3']);

        setScreen('game');
    };

    const handleMultiplayer = async () => {
        const playerId = getOrCreatePlayerId();
        gameController.init(playerId);
        gameController.setOnlineMode(true); // Prepare for online

        try {
            // Join or Create "cinco_vidas" room automatically
            // This ensures players land in the same room for testing
            await multiplayer.joinOrCreateRoom("cinco_vidas", { name: playerName });
            setScreen('game');
        } catch (e) {
            console.error(e);
            alert("Error al conectar: " + e);
            gameController.setOnlineMode(false);
        }
    };

    const currentScene = (_scene: Phaser.Scene) => {
        // Scene callback - can be used for React<->Phaser communication
    };

    if (screen === 'menu') {
        return (
            <div id="app">
                <div className="overlay">
                    <div className="panel flex-col gap-md" style={{ textAlign: 'center', width: '90%', maxWidth: '360px' }}>
                        <h1 style={{ marginBottom: '4px', textShadow: '0 0 30px rgba(230,184,0,0.3)' }}>
                            CINCO VIDAS
                        </h1>
                        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
                            Juego de cartas de baraja española
                        </p>

                        <input
                            className="input"
                            type="text"
                            placeholder="Tu nombre..."
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            maxLength={16}
                            onKeyDown={(e) => e.key === 'Enter' && handleStartGame()}
                        />

                        <button
                            className="btn btn-primary mt-sm"
                            onClick={() => {
                                audioManager.playClick();
                                handleStartGame();
                            }}
                            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                        >
                            🃏 Jugar vs Bots
                        </button>

                        <button
                            className="btn btn-secondary mt-sm"
                            onClick={() => {
                                audioManager.playClick();
                                handleMultiplayer();
                            }}
                            style={{ width: '100%', padding: '12px' }}
                        >
                            🌐 Crear Sala (Online)
                        </button>

                        <p className="text-muted" style={{ fontSize: '11px', marginTop: '24px' }}>
                            Assets: <a href="https://jcanabal.itch.io/spanish-deck-pixel-art"
                                style={{ color: '#8faa9a', textDecoration: 'none' }}
                                target="_blank" rel="noopener">
                                jcanabal
                            </a> · v0.1.0
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            <GameHUD />
        </div>
    );
}

function getOrCreatePlayerId(): string {
    try {
        const stored = localStorage.getItem('cinco-vidas-player');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.id) return parsed.id;
        }
    } catch { /* ignore */ }
    return crypto.randomUUID();
}

export default App;
