import { useGameStore } from '../store/gameStore';
import { gameController } from '../game/GameController';
import { useState } from 'react';
import { audioManager } from '../engine/AudioManager';

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
                    <span className="text-gold">Ronda {currentRound}</span>
                    <span>Cartas: {cardsThisRound}</span>
                    {turnTimer !== undefined && turnTimer > 0 && (
                        <span style={{ color: turnTimer <= 5 ? 'var(--color-red)' : '#fff' }}>⏱ {turnTimer}s</span>
                    )}
                </div>
            </div>

            {/* ── STATUS INDICATOR ── */}
            {isMyTurn && (
                <div className="hud-status">
                    <span className="status-badge">
                        {phase === 'predicting' ? 'TU TURNO DE PREDECIR' : 'TU TURNO'}
                    </span>
                </div>
            )}

            {/* ── LOBBY WAITING ── */}
            {phase === 'lobby' && (
                <div className="overlay">
                    <div className="panel flex-col flex-center" style={{ width: '90%', maxWidth: '400px' }}>
                        <h2 className="text-gold mb-md">Sala de Espera</h2>

                        <div className="lobby-list mb-lg">
                            {players.map((p, index) => (
                                <div key={p.id} className={`lobby-item ${p.id === myPlayerId ? 'is-me' : ''}`}>
                                    <div className="flex-center gap-sm">
                                        <div className="player-avatar" style={{ background: p.color }}></div>
                                        <span style={{ fontWeight: p.id === myPlayerId ? 'bold' : 'normal' }}>
                                            {p.name} {p.id === myPlayerId ? '(Tú)' : ''} {index === 0 ? '👑' : ''}
                                        </span>
                                    </div>
                                    <span title={p.isConnected ? 'Conectado' : 'Desconectado'}>{p.isConnected ? '🟢' : '🔴'}</span>
                                </div>
                            ))}
                            {players.length === 0 && <p className="text-muted p-md">Conectando...</p>}
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
                                {players.length < 2 ? 'Esperando jugadores (Mín 2)...' : 'EMPEZAR PARTIDA'}
                            </button>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', width: '100%' }}>
                                <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
                                    Esperando al anfitrión ({players[0]?.name}) para empezar...
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── PREDICTION MODAL ── */}
            {phase === 'predicting' && (
                <>
                    {/* Live Prediction Status Panel (Always visible during predicting) */}
                    <div className="hud-info-panel" style={{ position: 'absolute', top: '80px', right: '20px', flexDirection: 'column', padding: '12px', alignItems: 'flex-start', background: 'rgba(0,0,0,0.6)' }}>
                        <span className="text-gold" style={{ fontSize: '12px', marginBottom: '8px' }}>Predicciones:</span>
                        {players.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px', marginBottom: '4px', opacity: p.prediction >= 0 ? 1 : 0.5 }}>
                                <span style={{ color: p.isEliminated ? '#444' : '#fff' }}>{p.name}:</span>
                                <span style={{ fontWeight: 'bold', color: p.prediction >= 0 ? 'var(--color-gold)' : '#aaa' }}>
                                    {p.prediction >= 0 ? p.prediction : '-'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {isMyTurn && (
                        <div className="overlay" style={{ background: 'rgba(0,0,0,0)', backdropFilter: 'none', pointerEvents: 'auto', alignItems: 'flex-start', paddingTop: '20vh' }}>
                            <div className="panel flex-col flex-center" style={{ background: 'rgba(13, 31, 21, 0.95)', border: '2px solid var(--color-gold)', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
                                <h2 className="mb-md" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>¿Cuántas bazas harás?</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', width: '100%' }}>
                                    {Array.from({ length: (cardsThisRound || 0) + 1 }).map((_, i) => {
                                        // "Sandwich Rule" / Forbidden Prediction Logic
                                        // If I am the LAST player to predict, the sum of predictions cannot equal cardsThisRound.
                                        const totalPredictions = players.reduce((sum, p) => sum + (p.prediction >= 0 ? p.prediction : 0), 0);
                                        const pendingPlayers = players.filter(p => p.prediction === -1).length;
                                        // pendingPlayers includes ME (since I haven't predicted yet).
                                        // So if pendingPlayers === 1, I am the last one.
                                        const isLast = pendingPlayers === 1;
                                        const forbidden = isLast ? ((cardsThisRound || 0) - totalPredictions) : -1;
                                        const isForbidden = i === forbidden;

                                        return (
                                            <button
                                                key={i}
                                                className="btn btn-secondary"
                                                onClick={() => !isForbidden && handlePredict(i)}
                                                disabled={isForbidden}
                                                style={{
                                                    padding: '16px',
                                                    fontSize: '18px',
                                                    opacity: isForbidden ? 0.3 : 1,
                                                    cursor: isForbidden ? 'not-allowed' : 'pointer',
                                                    background: isForbidden ? '#333' : undefined,
                                                    textDecoration: isForbidden ? 'line-through' : 'none'
                                                }}
                                                title={isForbidden ? "Regla: La suma no puede igualar las cartas" : ""}
                                            >
                                                {i}
                                            </button>
                                        );
                                    })}
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
                        <h2 className="text-center mb-md">Resultados Ronda {currentRound}</h2>

                        <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                            <table className="scoreboard-table">
                                <thead>
                                    <tr>
                                        <th>Jugador</th>
                                        <th className="cell-center">Pred.</th>
                                        <th className="cell-center">Hechas</th>
                                        <th className="cell-right">Vidas</th>
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
                            Siguiente Ronda
                        </button>
                    </div>
                </div>
            )}
            {/* ── GAME OVER MODAL ── */}
            {phase === 'gameOver' && (
                <div className="overlay">
                    <div className="panel flex-col flex-center">
                        <h1 className="text-gold mb-md" style={{ fontSize: '36px' }}>FIN DEL JUEGO</h1>
                        {(() => {
                            const winner = players.find(p => !p.isEliminated);
                            if (winner) {
                                return <p style={{ fontSize: '18px', marginBottom: '24px' }}>¡Ganador: <strong className="text-gold">{winner.name}</strong>!</p>
                            } else {
                                return <p className="mb-lg">¡Empate final!</p>
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
                            Menú Principal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
