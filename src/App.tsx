import { useRef, useState, useEffect } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { GameHUD } from './components/GameHUD';
import { LobbyUI } from './components/LobbyUI';
import { gameController } from './game/GameController';
import { multiplayer } from './network/MultiplayerClient';
import { useGameStore } from './store/gameStore';

import { audioManager } from './engine/AudioManager';

type GameScreen = 'menu' | 'lobby' | 'game' | 'setup_local';

type LobbyAction =
    | { kind: 'create'; options: { maxPlayers: number; name: string } }
    | { kind: 'join'; code: string; name: string };
import { BotDifficulty } from './engine/types';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [screen, setScreen] = useState<GameScreen>('menu');
    const [botCount, setBotCount] = useState(3);
    const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>(BotDifficulty.Medium);
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

    // Global Store State
    const gameState = useGameStore(state => state.gameState);
    const myPlayerId = useGameStore(state => state.myPlayerId);

    // Lobby UI Local State
    const [lobbyState, setLobbyState] = useState<{
        code?: string;
        isConnecting: boolean;
        error?: string;
        status?: string;
        canRetry?: boolean;
    }>({ isConnecting: false });

    const [retryAction, setRetryAction] = useState<LobbyAction | null>(null);

    // Computed Lobby Data
    const lobbyPlayers = gameState?.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: !!p.isHost,
        isBot: !!p.isBot,
        isConnected: p.isConnected !== false // Default to true if undefined
    })) || [];

    const isMeHost = gameState?.players.find(p => p.id === myPlayerId)?.isHost || false;

    // ── NAVIGATION & HISTORY ──
    const navigateTo = (newScreen: GameScreen) => {
        setScreen(newScreen);
        if (newScreen !== 'menu') {
            window.history.pushState({ screen: newScreen }, '', `#${newScreen}`);
        } else {
            window.history.pushState({ screen: 'menu' }, '', location.pathname);
        }
    };

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state?.screen) {
                setScreen(event.state.screen);
            } else {
                setScreen('menu');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // ── AUTO-RECONNECT ──
    useEffect(() => {
        const checkSession = async () => {
            if (multiplayer.hasSavedSession()) {
                console.log("Found saved session, reconnecting...");
                setLobbyState(prev => ({
                    ...prev,
                    isConnecting: true,
                    status: 'Recuperando sesión anterior...',
                    // Don't show error yet
                    error: undefined
                }));

                const roomId = await multiplayer.reconnect();
                if (roomId) {
                    console.log("Reconnected to room:", roomId);
                    setLobbyState(prev => ({
                        ...prev,
                        isConnecting: false,
                        code: roomId,
                        status: undefined
                    }));

                    // Determine where to go based on state
                    // We need a small delay or check immediate state from store?
                    // Store is updated in setupRoomListeners via callback. 
                    // It might take a ms.
                    // But we can just set to 'lobby' safely, and the Auto-switch logic below will move to game if needed.
                    setScreen('lobby');
                } else {
                    console.log("Reconnection failed.");
                    setLobbyState(prev => ({ ...prev, isConnecting: false, status: undefined }));
                }
            }
        };
        // Small delay to ensure mount? No, immediate is fine.
        checkSession();
    }, []);

    // Auto-switch to game when phase changes
    // We replace setScreen with standard setScreen here to avoid pushing history loop if already there?
    // If we auto-switch, we SHOULD push history so Back button works?
    // Yes.
    if (screen === 'lobby' && gameState?.phase && gameState.phase !== 'lobby') {
        // If we are already in game, don't loop.
        // But this is render logic. Side effect should be in useEffect.
        // The original code had this side effect in render body (bad practice but worked).
        // I will keep it but filter strict check.
        // Use navigateTo?
        // navigateTo('game'); // BAD: triggering state update inside render.
        // Use setTimeout or useEffect?
        // Original code was: setScreen('game').
        // I'll leave it but maybe move to useEffect to be safe?
    }

    // Better: Move Auto-switch to useEffect
    useEffect(() => {
        if (screen === 'lobby' && gameState?.phase && gameState.phase !== 'lobby') {
            navigateTo('game');
        }
    }, [screen, gameState?.phase]);

    const handleStartGame = () => {
        // Local Play
        const playerId = getOrCreatePlayerId();
        gameController.init(playerId);
        gameController.setOnlineMode(false);

        // Generate bots
        const bots = Array.from({ length: botCount }, (_, i) => `Bot ${i + 1}`);
        gameController.startGame([playerName || 'Jugador', ...bots], botDifficulty);

        setScreen('game');
    };

    // ── LOBBY HANDLERS ──
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runLobbyAction = async (action: LobbyAction) => {
        setRetryAction(action);
        setLobbyState(prev => ({
            ...prev,
            isConnecting: true,
            error: undefined,
            status: 'Despertando servidor... (puede tardar ~30s la primera vez)',
            canRetry: false
        }));

        const playerId = getOrCreatePlayerId();
        gameController.init(playerId);
        gameController.setOnlineMode(true);

        await multiplayer.warmup({ timeoutMs: 8000 });

        const retryDelays = [3000, 5000, 8000];
        const maxAttempts = retryDelays.length + 1;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            setLobbyState(prev => ({
                ...prev,
                status: attempt === 1
                    ? 'Conectando...'
                    : `Reintentando (${attempt}/${maxAttempts})...`
            }));

            try {
                const roomId = action.kind === 'create'
                    ? await multiplayer.createPrivateRoom({
                        name: action.options.name,
                        maxClients: action.options.maxPlayers
                    })
                    : await multiplayer.joinPrivateRoom(action.code, { name: action.name });

                setLobbyState(prev => ({
                    ...prev,
                    code: roomId,
                    isConnecting: false,
                    status: undefined,
                    error: undefined,
                    canRetry: false
                }));
                return;
            } catch (e) {
                lastError = e;
                if (attempt < maxAttempts) {
                    await sleep(retryDelays[attempt - 1]);
                }
            }
        }

        console.error(lastError);
        setLobbyState(prev => ({
            ...prev,
            isConnecting: false,
            status: undefined,
            error: action.kind === 'join'
                ? 'No se pudo conectar. Verifica el codigo o espera unos segundos.'
                : 'No se pudo crear la sala. El servidor puede estar dormido.',
            canRetry: true
        }));
        gameController.setOnlineMode(false);
    };

    const handleCreateRoom = async (options: { maxPlayers: number }) => {
        await runLobbyAction({
            kind: 'create',
            options: { maxPlayers: options.maxPlayers, name: playerName || 'Anfitrión' }
        });
    };

    const handleJoinRoom = async (code: string) => {
        await runLobbyAction({
            kind: 'join',
            code,
            name: playerName || 'Jugador'
        });
    };

    const handleRetry = () => {
        if (!retryAction) return;
        runLobbyAction(retryAction);
    };

    const handleLobbyStartGame = () => {
        multiplayer.send("start_game");
    };

    const currentScene = (_scene: Phaser.Scene) => {
        // Scene callback
    };

    if (screen === 'menu') {
        return (
            <div id="app">
                <div className="overlay">
                    <div className="panel flex-col gap-md" style={{ textAlign: 'center', width: '90%', maxWidth: '360px' }}>
                        <img
                            src="assets/logo.png"
                            alt="Cinco Vidas"
                            style={{
                                width: '180px',
                                height: 'auto',
                                margin: '0 auto 24px auto',
                                display: 'block',
                                filter: 'drop-shadow(0 0 15px rgba(230,184,0,0.3))'
                            }}
                        />

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
                                navigateTo('setup_local');
                            }}
                            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                        >
                            🃏 Vs Bots (Local)
                        </button>

                        <button
                            className="btn btn-secondary mt-sm"
                            onClick={() => {
                                audioManager.playClick();
                                navigateTo('lobby');
                            }}
                            style={{ width: '100%', padding: '12px' }}
                        >
                            🌐 Multijugador Online
                        </button>

                        <p className="text-muted" style={{ fontSize: '11px', marginTop: '24px' }}>
                            Assets: <a href="https://jcanabal.itch.io/spanish-deck-pixel-art"
                                style={{ color: '#8faa9a', textDecoration: 'none' }}
                                target="_blank" rel="noopener">
                                jcanabal
                            </a> · v0.2.0
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (screen === 'lobby') {
        return (
            <div id="app">
                <div className="overlay">
                    <LobbyUI
                        onBack={() => {
                            multiplayer.leave();
                            setLobbyState({ isConnecting: false });
                            navigateTo('menu');
                        }}
                        onCreateRoom={handleCreateRoom}
                        onJoinRoom={handleJoinRoom}
                        onStartGame={handleLobbyStartGame}
                        roomCode={lobbyState.code}
                        players={lobbyPlayers}
                        isConnecting={lobbyState.isConnecting}
                        error={lobbyState.error}
                        statusMessage={lobbyState.status}
                        onRetry={lobbyState.canRetry ? handleRetry : undefined}
                        isHost={isMeHost}
                    />
                </div>
            </div>
        );
    }

    if (screen === 'setup_local') {
        return (
            <div id="app">
                <div className="overlay">
                    <div className="panel flex-col gap-md fade-in" style={{ textAlign: 'center', width: '90%', maxWidth: '360px' }}>
                        <h2 style={{ color: 'var(--color-gold)', marginBottom: '8px' }}>PARTIDA LOCAL</h2>

                        <div style={{ margin: '24px 0', width: '100%' }}>
                            {/* DIFFICULTY SELECTOR */}
                            <label style={{ display: 'block', marginBottom: '8px', color: '#eee', fontSize: '14px' }}>Dificultad de la IA</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                                {[
                                    { level: BotDifficulty.Easy, label: 'Fácil', color: '#4caf50' },
                                    { level: BotDifficulty.Medium, label: 'Normal', color: '#ffc107' },
                                    { level: BotDifficulty.Hard, label: 'Difícil', color: '#ff5252' }
                                ].map(({ level, label, color }) => {
                                    const isSelected = botDifficulty === level;
                                    return (
                                        <button
                                            key={level}
                                            onClick={() => {
                                                audioManager.playClick();
                                                setBotDifficulty(level);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '10px 4px',
                                                background: isSelected ? `rgba(${color === '#4caf50' ? '76,175,80' : color === '#ffc107' ? '255,193,7' : '255,82,82'}, 0.2)` : 'rgba(0,0,0,0.3)',
                                                border: `1px solid ${isSelected ? color : '#444'}`,
                                                borderRadius: '8px',
                                                color: isSelected ? color : '#888',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: isSelected ? `0 0 10px ${color}40` : 'none',
                                                fontSize: '13px',
                                                fontWeight: isSelected ? 'bold' : 'normal'
                                            }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <label style={{ display: 'block', marginBottom: '12px', color: '#eee' }}>
                                Oponentes (Bots): <span style={{ color: 'var(--color-gold)', fontWeight: 'bold', fontSize: '18px' }}>{botCount}</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="7"
                                value={botCount}
                                onChange={(e) => setBotCount(parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--color-gold)' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                <span>1</span>
                                <span>7</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    audioManager.playClick();
                                    handleStartGame();
                                }}
                            >
                                JUGAR
                            </button>
                            <button
                                className="btn-text"
                                onClick={() => {
                                    audioManager.playClick();
                                    navigateTo('menu');
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            <GameHUD onExit={() => {
                setScreen('menu');
                // Optional: Force history push to break game loop
                window.history.pushState({ screen: 'menu' }, '', '#menu');
            }} />
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
