import React, { useState } from 'react';
import { audioManager } from '../engine/AudioManager';

type LobbyView = 'menu' | 'host' | 'join' | 'create_setup';

interface LobbyPlayer {
    id: string;
    name: string;
    isHost?: boolean;
    isBot?: boolean;
    isConnected?: boolean;
}

interface Props {
    onBack: () => void;
    onCreateRoom: (options: { maxPlayers: number }) => void;
    onJoinRoom: (code: string) => void;
    onStartGame: () => void;
    roomCode?: string;
    players?: LobbyPlayer[];
    isConnecting?: boolean;
    error?: string | null;
    statusMessage?: string;
    onRetry?: () => void;
    isHost?: boolean;
}

export const LobbyUI: React.FC<Props> = ({
    onBack,
    onCreateRoom,
    onJoinRoom,
    onStartGame,
    roomCode,
    players = [],
    isConnecting = false,
    error,
    statusMessage,
    onRetry,
    isHost = false
}) => {
    // Local UI state for navigation within the Lobby component
    const [view, setView] = useState<LobbyView>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [maxPlayers, setMaxPlayers] = useState(4);

    // If roomCode is present, force view to 'host' (we are in a room)
    // This allows parent component to control state via roomCode presence
    // effectively acting as "In Lobby Mode"
    const effectiveView = roomCode ? 'host' : view;

    const handleCreateSetup = () => {
        audioManager.playClick();
        setView('create_setup');
    };

    const handleCreateConfirm = () => {
        audioManager.playClick();
        onCreateRoom({ maxPlayers });
        // View will update to 'host' via props change (roomCode)
    };

    const handleJoin = () => {
        audioManager.playClick();
        if (joinCode.length === 4) {
            onJoinRoom(joinCode);
        }
    };

    // ── VIEW: MAIN MENU ──
    if (effectiveView === 'menu') {
        return (
            <div className="panel flex-col gap-md fade-in" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--color-gold)', textShadow: '0 0 10px rgba(230,184,0,0.3)', marginBottom: '16px' }}>
                    MULTIPLAYER
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleCreateSetup}
                        disabled={isConnecting}
                        style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                    >
                        <span style={{ fontSize: '24px' }}>🏠</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>CREAR SALA</span>
                            <span style={{ fontSize: '12px', opacity: 0.8 }}>Ser el anfitrión</span>
                        </div>
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            audioManager.playClick();
                            setView('join');
                        }}
                        style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                    >
                        <span style={{ fontSize: '24px' }}>🔗</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>UNIRSE</span>
                            <span style={{ fontSize: '12px', opacity: 0.8 }}>Con código de sala</span>
                        </div>
                    </button>

                    <button className="btn-text mt-sm" onClick={onBack}>
                        ← Volver al Menú
                    </button>
                </div>
            </div>
        );
    }

    // ── VIEW: CREATE SETUP ──
    if (effectiveView === 'create_setup') {
        return (
            <div className="panel flex-col gap-md fade-in" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--color-gold)', marginBottom: '8px' }}>CONFIGURAR SALA</h2>

                <div style={{ margin: '24px 0', width: '100%' }}>
                    <label style={{ display: 'block', marginBottom: '12px', color: '#eee' }}>
                        Máximo de Jugadores: <span style={{ color: 'var(--color-gold)', fontWeight: 'bold', fontSize: '18px' }}>{maxPlayers}</span>
                    </label>
                    <input
                        type="range"
                        min="2"
                        max="8"
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-gold)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        <span>2</span>
                        <span>8</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleCreateConfirm}
                        disabled={isConnecting}
                    >
                        {isConnecting ? 'CREANDO...' : 'CREAR SALA'}
                    </button>
                    {statusMessage && (
                        <div className="status-banner">
                            {statusMessage}
                        </div>
                    )}
                    {onRetry && !isConnecting && (
                        <button className="btn btn-secondary" onClick={onRetry}>
                            REINTENTAR
                        </button>
                    )}
                    <button className="btn-text" onClick={() => setView('menu')} disabled={isConnecting}>
                        Cancelar
                    </button>
                </div>
            </div>
        );
    }

    // ── VIEW: JOIN ROOM INPUT ──
    if (effectiveView === 'join') {
        return (
            <div className="panel flex-col gap-md fade-in" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--color-gold)', marginBottom: '8px' }}>UNIRSE A SALA</h2>
                <p className="text-muted" style={{ fontSize: '14px', marginBottom: '16px' }}>
                    Pide el código al anfitrión
                </p>

                <input
                    type="text"
                    maxLength={4}
                    placeholder="K7P9"
                    value={joinCode}
                    onChange={(e) => {
                        // Strict Alphanumeric Uppercase
                        const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setJoinCode(clean);
                    }}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '2px solid var(--color-gold)',
                        borderRadius: '12px',
                        color: 'var(--color-gold)',
                        fontSize: '32px',
                        textAlign: 'center',
                        letterSpacing: '8px',
                        width: '200px',
                        padding: '12px',
                        textTransform: 'uppercase',
                        fontWeight: 'bold'
                    }}
                    autoFocus
                />

                {error && <div style={{ color: '#ff4444', fontSize: '14px', marginTop: '8px' }}>{error}</div>}
                {statusMessage && (
                    <div className="status-banner" style={{ marginTop: '8px' }}>
                        {statusMessage}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '24px' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleJoin}
                        disabled={joinCode.length !== 4 || isConnecting}
                    >
                        {isConnecting ? 'CONECTANDO...' : 'ENTRAR A SALA'}
                    </button>
                    {onRetry && !isConnecting && (
                        <button className="btn btn-secondary" onClick={onRetry}>
                            REINTENTAR
                        </button>
                    )}
                    <button className="btn-text" onClick={() => setView('menu')} disabled={isConnecting}>
                        Cancelar
                    </button>
                </div>
            </div>
        );
    }

    // ── VIEW: HOST LOBBY (WAITING ROOM) ──
    if (effectiveView === 'host') {
        return (
            <div className="panel flex-col gap-md fade-in" style={{ width: '95%', maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                    <h2 style={{ color: 'var(--color-gold)', margin: 0 }}>SALA DE ESPERA</h2>
                    <span style={{ fontSize: '12px', background: 'rgba(230,184,0,0.2)', color: 'var(--color-gold)', padding: '4px 8px', borderRadius: '4px' }}>
                        {players.length}/4
                    </span>
                </div>

                <div
                    onClick={() => {
                        if (roomCode) navigator.clipboard.writeText(roomCode);
                        // Add toast feedback here ideally
                    }}
                    style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '2px dashed var(--color-gold)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        margin: '8px 0'
                    }}
                >
                    <span style={{ fontSize: '12px', color: '#aaa', letterSpacing: '1px' }}>CÓDIGO DE SALA</span>
                    <span style={{ fontSize: '42px', fontWeight: 'bold', color: 'var(--color-gold)', letterSpacing: '4px', textShadow: '0 0 15px rgba(230,184,0,0.4)' }}>
                        {roomCode || "----"}
                    </span>
                    <span style={{ fontSize: '10px', color: '#666' }}>(Toca para copiar)</span>
                </div>

                <div className="players-list" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {players.map((p) => {
                        const isOffline = p.isConnected === false; // If undefined, assume connected
                        return (
                            <div key={p.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '8px',
                                border: p.isHost ? '1px solid rgba(230,184,0,0.3)' : '1px solid transparent',
                                opacity: isOffline ? 0.5 : 1
                            }}>
                                <span style={{ fontSize: '20px', marginRight: '12px' }}>
                                    {p.isBot ? '🤖' : (isOffline ? '🔌' : '👤')}
                                </span>
                                <div style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: p.isHost ? 'bold' : 'normal', color: p.isHost ? 'var(--color-gold)' : '#eee' }}>
                                        {p.name}
                                    </span>
                                    {isOffline && <span style={{ fontSize: '10px', color: '#aaa' }}>Desconectado...</span>}
                                </div>
                                {p.isHost && <span style={{ fontSize: '12px', color: 'var(--color-gold)' }}>ANFITRIÓN</span>}
                            </div>
                        );
                    })}
                    {[...Array(Math.max(0, 4 - players.length))].map((_, i) => (
                        <div key={`empty-${i}`} style={{
                            padding: '10px',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            border: '1px dashed rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.5
                        }}>
                            <span style={{ fontSize: '20px', marginRight: '12px', filter: 'grayscale(1)' }}>👤</span>
                            <span style={{ fontSize: '13px', fontStyle: 'italic' }}>Esperando jugador...</span>
                        </div>
                    ))}
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                    {isHost ? (
                        <button
                            className="btn btn-primary w-full"
                            style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold' }}
                            onClick={() => {
                                audioManager.playClick();
                                onStartGame();
                            }}
                            disabled={players.length < 2 && !players.some(p => p.isBot) && players.filter(p => p.isConnected !== false).length < 2} // Require 2 connected players or bots
                        >
                            EMPEZAR PARTIDA
                        </button>
                    ) : (
                        <div style={{ padding: '12px', background: 'rgba(230,184,0,0.1)', borderRadius: '8px', color: 'var(--color-gold)', fontSize: '14px' }}>
                            Esperando al anfitrión...
                        </div>
                    )}

                    <button
                        className="btn"
                        onClick={onBack}
                        style={{
                            background: 'rgba(255, 68, 68, 0.15)',
                            border: '1px solid rgba(255, 68, 68, 0.5)',
                            color: '#ff6666',
                            width: '100%',
                            padding: '12px',
                            marginTop: '16px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            minHeight: '48px'
                        }}
                    >
                        {isHost ? 'Cancelar Sala' : 'Salir de Sala'}
                    </button>
                </div>
            </div>
        );
    }

    return null;
};
