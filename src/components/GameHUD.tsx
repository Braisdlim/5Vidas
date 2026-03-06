import { useGameStore } from '../store/gameStore';
import { gameController } from '../game/GameController';
import { useState, useEffect } from 'react';
import { audioManager } from '../engine/AudioManager';
import { EventBus } from '../game/EventBus';
import { useTranslation } from '../i18n';

export function GameHUD() {
    // Subscribe only to relevant state parts to avoid excessive re-renders
    const phase = useGameStore(state => state.gameState?.phase);
    const activePlayerIndex = useGameStore(state => state.gameState?.activePlayerIndex);
    const myPlayerId = useGameStore(state => state.myPlayerId);
    const players = useGameStore(state => state.gameState?.players);
    const turnTimer = useGameStore(state => state.gameState?.turnTimer);
    const cardsThisRound = useGameStore(state => state.gameState?.cardsThisRound);
    const dealerIndex = useGameStore(state => state.gameState?.dealerIndex);
    const currentRound = useGameStore(state => state.gameState?.currentRound);

    // Derived state
    const myPlayer = players?.find(p => p.id === myPlayerId);
    const isMyTurn = activePlayerIndex !== undefined && players?.[activePlayerIndex]?.id === myPlayerId;

    // Prediction handling
    const [, setPrediction] = useState<number | null>(null);

    // Scoreboard panel toggle for mobile
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    // Mobile detection
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

    const { t } = useTranslation();

    // Auto-open panel when prediction phase starts
    useEffect(() => {
        if (phase === 'predicting') {
            setIsPanelOpen(true);
        }
    }, [phase]);

    // Handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Listen to scoreboard toggle event from Phaser button
    useEffect(() => {
        const handleToggle = () => {
            setIsPanelOpen(prev => !prev);
        };

        EventBus.on('toggle-scoreboard', handleToggle);

        return () => {
            EventBus.off('toggle-scoreboard', handleToggle);
        };
    }, []);

    const handlePredict = (val: number) => {
        audioManager.playClick();
        setPrediction(val); // optimistic UI?
        gameController.makePrediction(val);
        setPrediction(null);
    };

    if (!players || !myPlayer) return null;

    return (
        <div className="game-hud" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>

            {/* ── Top Bar Info ── */}
            <div className="hud-top-bar">
                <div className="hud-info-panel">
                    <span className="text-gold">{t('hud.round')} {currentRound}</span>
                    <span>{t('hud.cards')} {cardsThisRound}</span>
                    {turnTimer !== undefined && turnTimer > 0 && (
                        <span style={{ color: turnTimer <= 5 ? 'var(--color-red)' : '#fff' }}>⏱ {turnTimer}s</span>
                    )}
                </div>
            </div>

            {/* ── STATUS INDICATOR ── */}
            {isMyTurn && (
                <div className="hud-status">
                    <span className="status-badge">
                        {phase === 'predicting' ? t('hud.yourTurnPredict') : t('hud.yourTurn')}
                    </span>
                </div>
            )}

            {/* ── LOBBY WAITING ── */}
            {phase === 'lobby' && (
                <div className="overlay">
                    <div className="panel flex-col flex-center" style={{ width: '90%', maxWidth: '400px' }}>
                        <h2 className="text-gold mb-md">{t('hud.waitingRoom')}</h2>

                        <div className="lobby-list mb-lg">
                            {players.map((p, index) => (
                                <div key={p.id} className={`lobby-item ${p.id === myPlayerId ? 'is-me' : ''}`}>
                                    <div className="flex-center gap-sm">
                                        <div className="player-avatar" style={{ background: p.color }}></div>
                                        <span style={{ fontWeight: p.id === myPlayerId ? 'bold' : 'normal' }}>
                                            {p.name} {p.id === myPlayerId ? t('hud.you') : ''} {index === 0 ? '👑' : ''}
                                        </span>
                                    </div>
                                    <span title={p.isConnected ? t('hud.connected') : t('hud.disconnectedStatus')}>{p.isConnected ? '🟢' : '🔴'}</span>
                                </div>
                            ))}
                            {players.length === 0 && <p className="text-muted p-md">{t('hud.connectingDots')}</p>}
                        </div>

                        {/* Only Host can start (Player 0) */}
                        {players.length > 0 && players[0].id === myPlayerId ? (
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    audioManager.playClick();
                                    gameController.startGame([]);
                                }}
                                disabled={players.length < 2}
                                style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                            >
                                {players.length < 2 ? t('hud.waitingMinPlayers') : t('hud.startMatch')}
                            </button>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', width: '100%' }}>
                                <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
                                    {t('hud.waitingHostStart', { name: players[0]?.name || '' })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}




            {/* ── PERSISTENT PREDICTION PANEL ── */}
            {(phase === 'predicting' || phase === 'playing') &&
                !(isMobile && isMyTurn && phase === 'predicting') && (
                    <div
                        className="hud-info-panel"
                        style={{
                            position: 'absolute', // Inside relative #app
                            top: '80px',
                            right: isPanelOpen ? '20px' : '-220px',
                            flexDirection: 'column',
                            padding: '16px',
                            alignItems: 'flex-start',
                            background: 'rgba(13, 31, 21, 0.95)',
                            border: '1px solid var(--color-gold)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                            minWidth: '180px',
                            transition: 'right 0.3s ease',
                            zIndex: 99
                        }}
                    >
                        <span className="text-gold" style={{
                            fontSize: '14px',
                            marginBottom: '8px',
                            borderBottom: '1px solid #444',
                            width: '100%',
                            paddingBottom: '4px',
                            fontWeight: 'bold'
                        }}>
                            {phase === 'predicting' ? t('hud.predictions') : t('hud.scoreboard')}
                        </span>
                        {players.map(p => {
                            const isComplete = phase === 'playing' && p.prediction >= 0;
                            const isCorrect = isComplete && p.prediction === p.tricksWon;

                            return (
                                <div key={p.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    fontSize: '13px',
                                    marginBottom: '6px',
                                    opacity: p.isEliminated ? 0.5 : (p.prediction >= 0 ? 1 : 0.5),
                                    transition: 'all 0.2s ease'
                                }}>
                                    <span style={{
                                        color: p.isEliminated ? '#666' : '#eee',
                                        fontWeight: p.id === myPlayerId ? 'bold' : 'normal',
                                        textShadow: p.id === myPlayerId ? '0 0 8px rgba(230,184,0,0.5)' : 'none'
                                    }}>
                                        {p.name} {p.isEliminated ? '💀' : ''} {p.id === activePlayerIndex?.toString() || (players.indexOf(p) === activePlayerIndex) ? '⏳' : ''}
                                    </span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: p.isEliminated ? '#666' : (isCorrect ? '#4ade80' : (p.prediction >= 0 ? 'var(--color-gold)' : '#888')),
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {p.isEliminated ? '—' : (
                                            phase === 'playing' && p.prediction >= 0 ? (
                                                <>
                                                    {p.tricksWon} / {p.prediction} {isCorrect ? '✓' : ''}
                                                </>
                                            ) : (
                                                p.prediction >= 0 ? p.prediction : '-'
                                            )
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

            {/* ── PREDICTION MODAL ── */}
            {phase === 'predicting' && (
                <>
                    {isMyTurn && !myPlayer?.isEliminated && (
                        /* Centered compact modal */
                        <div className="overlay prediction-overlay">
                            <div className="panel flex-col flex-center prediction-panel">
                                <h2 style={{
                                    fontSize: isMobile ? '16px' : '18px',
                                    marginBottom: '12px',
                                    textAlign: 'center',
                                    color: '#E6B800',
                                    fontWeight: 'bold',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                }}>
                                    {t('hud.howManyTricks')}
                                </h2>
                                <div className="prediction-grid">
                                    {(() => {
                                        // "Sandwich Rule" Logic
                                        const activePlayers = players.filter(p => !p.isEliminated);
                                        const totalPredictions = activePlayers.reduce((sum, p) => sum + (p.prediction >= 0 ? p.prediction : 0), 0);
                                        const pendingPlayers = activePlayers.filter(p => p.prediction === -1).length;
                                        // If I am active, I am pending. If pending == 1, I am the last one.
                                        const isLast = pendingPlayers === 1;
                                        const calculatedForbidden = isLast ? ((cardsThisRound || 0) - totalPredictions) : -1;

                                        return (
                                            <>
                                                {Array.from({ length: (cardsThisRound || 0) + 1 }).map((_, i) => {
                                                    const isForbidden = i === calculatedForbidden;
                                                    return (
                                                        <button
                                                            key={i}
                                                            className={`prediction-chip ${isForbidden ? 'is-forbidden' : ''}`}
                                                            onClick={() => !isForbidden && handlePredict(i)}
                                                            disabled={isForbidden}
                                                            title={isForbidden ? t('hud.sandwichTooltip') : ""}
                                                        >
                                                            {i}
                                                        </button>
                                                    );
                                                })}
                                                {calculatedForbidden !== -1 && calculatedForbidden >= 0 && calculatedForbidden <= (cardsThisRound || 0) && (
                                                    <p style={{
                                                        fontSize: '11px',
                                                        color: '#ff6b6b',
                                                        width: '100%',
                                                        textAlign: 'center',
                                                        marginTop: '8px',
                                                        gridColumn: '1 / -1',
                                                        lineHeight: '1.3'
                                                    }}>
                                                        ⚠️ {calculatedForbidden} {t('hud.sandwichBlocked')}
                                                    </p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── SCOREBOARD MODAL ── */}
            {phase === 'scoring' && (
                <div className="overlay">
                    <div className="panel flex-col" style={{ maxWidth: '500px', width: '90%' }}>
                        <h2 className="text-center mb-md">{t('scoring.title')} {currentRound}</h2>

                        <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                            <table className="scoreboard-table">
                                <thead>
                                    <tr>
                                        <th>{t('scoring.player')}</th>
                                        <th className="cell-center">{t('scoring.pred')}</th>
                                        <th className="cell-center">{t('scoring.won')}</th>
                                        <th className="cell-right">{t('scoring.lives')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ color: p.isEliminated ? '#444' : '#fff' }}>
                                                {p.name} {players[dealerIndex!]?.id === p.id ? '(D)' : ''}
                                            </td>
                                            <td className="cell-center text-gold">{p.prediction}</td>
                                            <td className="cell-center">{p.tricksWon}</td>
                                            <td className="cell-right">
                                                <span className={p.lives <= 0 ? 'text-muted' : 'text-danger'}>
                                                    {p.lives <= 0 ? '💀' : '♥'.repeat(p.lives)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            className="btn btn-primary mt-lg"
                            onClick={() => {
                                audioManager.playClick();
                                gameController.continueRound();
                            }}
                            style={{ padding: '14px', fontSize: '16px' }}
                        >
                            {t('scoring.nextRound')}
                        </button>
                    </div>
                </div>
            )}
            {/* ── GAME OVER MODAL ── */}
            {phase === 'gameOver' && (
                <div className="overlay">
                    <div className="panel flex-col flex-center">
                        <h1 className="text-gold mb-md" style={{ fontSize: '36px' }}>{t('gameOver.title')}</h1>
                        {(() => {
                            const winner = players.find(p => !p.isEliminated);
                            if (winner) {
                                return <p style={{ fontSize: '18px', marginBottom: '24px' }}>{t('gameOver.winner')} <strong className="text-gold">{winner.name}</strong>!</p>
                            } else {
                                return <p className="mb-lg">{t('gameOver.draw')}</p>
                            }
                        })()}

                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                audioManager.playClick();
                                window.location.reload();
                            }}
                            style={{ padding: '16px 32px' }}
                        >
                            {t('gameOver.mainMenu')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
