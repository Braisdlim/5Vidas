// ============================================================
// Cinco Vidas — Translations (ES / EN)
// ============================================================

export type Lang = 'es' | 'en';

const translations = {
    // ── Main Menu ──
    'menu.namePlaceholder': { es: 'Tu nombre...', en: 'Your name...' },
    'menu.vsBots': { es: '🃏 Vs Bots (Local)', en: '🃏 Vs Bots (Local)' },
    'menu.multiplayer': { es: '🌐 Multijugador Online', en: '🌐 Online Multiplayer' },

    // ── Local Setup ──
    'setup.title': { es: 'PARTIDA LOCAL', en: 'LOCAL GAME' },
    'setup.difficulty': { es: 'Dificultad de la IA', en: 'AI Difficulty' },
    'setup.easy': { es: 'Fácil', en: 'Easy' },
    'setup.medium': { es: 'Normal', en: 'Normal' },
    'setup.hard': { es: 'Difícil', en: 'Hard' },
    'setup.opponents': { es: 'Oponentes (Bots):', en: 'Opponents (Bots):' },
    'setup.play': { es: 'JUGAR', en: 'PLAY' },
    'setup.cancel': { es: 'Cancelar', en: 'Cancel' },

    // ── Lobby / Multiplayer ──
    'lobby.title': { es: 'MULTIPLAYER', en: 'MULTIPLAYER' },
    'lobby.createRoom': { es: 'CREAR SALA', en: 'CREATE ROOM' },
    'lobby.createRoomSub': { es: 'Ser el anfitrión', en: 'Be the host' },
    'lobby.joinRoom': { es: 'UNIRSE', en: 'JOIN' },
    'lobby.joinRoomSub': { es: 'Con código de sala', en: 'With room code' },
    'lobby.backToMenu': { es: '← Volver al Menú', en: '← Back to Menu' },

    // ── Create Setup ──
    'lobby.configTitle': { es: 'CONFIGURAR SALA', en: 'CONFIGURE ROOM' },
    'lobby.maxPlayers': { es: 'Máximo de Jugadores:', en: 'Max Players:' },
    'lobby.creating': { es: 'CREANDO...', en: 'CREATING...' },
    'lobby.createConfirm': { es: 'CREAR SALA', en: 'CREATE ROOM' },
    'lobby.retry': { es: 'REINTENTAR', en: 'RETRY' },

    // ── Join Room ──
    'lobby.joinTitle': { es: 'UNIRSE A SALA', en: 'JOIN ROOM' },
    'lobby.askCode': { es: 'Pide el código al anfitrión', en: 'Ask the host for the code' },
    'lobby.connecting': { es: 'CONECTANDO...', en: 'CONNECTING...' },
    'lobby.enterRoom': { es: 'ENTRAR A SALA', en: 'ENTER ROOM' },

    // ── Host Lobby ──
    'lobby.waitingRoom': { es: 'SALA DE ESPERA', en: 'WAITING ROOM' },
    'lobby.roomCode': { es: 'CÓDIGO DE SALA', en: 'ROOM CODE' },
    'lobby.tapToCopy': { es: '(Toca para copiar)', en: '(Tap to copy)' },
    'lobby.disconnected': { es: 'Desconectado...', en: 'Disconnected...' },
    'lobby.host': { es: 'ANFITRIÓN', en: 'HOST' },
    'lobby.waitingPlayer': { es: 'Esperando jugador...', en: 'Waiting for player...' },
    'lobby.startGame': { es: 'EMPEZAR PARTIDA', en: 'START GAME' },
    'lobby.waitingHost': { es: 'Esperando al anfitrión...', en: 'Waiting for host...' },
    'lobby.cancelRoom': { es: 'Cancelar Sala', en: 'Cancel Room' },
    'lobby.leaveRoom': { es: 'Salir de Sala', en: 'Leave Room' },

    // ── Connection Status ──
    'connection.waking': { es: 'Despertando servidor... (puede tardar ~30s la primera vez)', en: 'Waking server... (may take ~30s the first time)' },
    'connection.connecting': { es: 'Conectando...', en: 'Connecting...' },
    'connection.retrying': { es: 'Reintentando', en: 'Retrying' },
    'connection.recovering': { es: 'Recuperando sesión anterior...', en: 'Recovering previous session...' },
    'connection.joinError': { es: 'No se pudo conectar. Verifica el código o espera unos segundos.', en: 'Could not connect. Check the code or wait a few seconds.' },
    'connection.createError': { es: 'No se pudo crear la sala. El servidor puede estar dormido.', en: 'Could not create the room. The server may be sleeping.' },

    // ── Game HUD ──
    'hud.round': { es: 'Ronda', en: 'Round' },
    'hud.cards': { es: 'Cartas:', en: 'Cards:' },
    'hud.yourTurnPredict': { es: 'TU TURNO DE PREDECIR', en: 'YOUR TURN TO PREDICT' },
    'hud.yourTurn': { es: 'TU TURNO', en: 'YOUR TURN' },

    // ── In-Game Lobby ──
    'hud.waitingRoom': { es: 'Sala de Espera', en: 'Waiting Room' },
    'hud.you': { es: '(Tú)', en: '(You)' },
    'hud.connected': { es: 'Conectado', en: 'Connected' },
    'hud.disconnectedStatus': { es: 'Desconectado', en: 'Disconnected' },
    'hud.connectingDots': { es: 'Conectando...', en: 'Connecting...' },
    'hud.waitingMinPlayers': { es: 'Esperando jugadores (Mín 2)...', en: 'Waiting for players (Min 2)...' },
    'hud.startMatch': { es: 'EMPEZAR PARTIDA', en: 'START GAME' },
    'hud.waitingHostStart': { es: 'Esperando al anfitrión ({name}) para empezar...', en: 'Waiting for host ({name}) to start...' },

    // ── Prediction Panel ──
    'hud.predictions': { es: 'Predicciones', en: 'Predictions' },
    'hud.scoreboard': { es: 'Marcador', en: 'Scoreboard' },
    'hud.howManyTricks': { es: '¿Cuántas bazas?', en: 'How many tricks?' },
    'hud.sandwichBlocked': { es: 'bloqueado (Sandwich)', en: 'blocked (Sandwich)' },
    'hud.sandwichTooltip': { es: 'Regla: La suma no puede igualar las cartas', en: 'Rule: The total cannot equal the number of cards' },

    // ── Scoring ──
    'scoring.title': { es: 'Resultados Ronda', en: 'Round Results' },
    'scoring.player': { es: 'Jugador', en: 'Player' },
    'scoring.pred': { es: 'Pred.', en: 'Pred.' },
    'scoring.won': { es: 'Hechas', en: 'Won' },
    'scoring.lives': { es: 'Vidas', en: 'Lives' },
    'scoring.nextRound': { es: 'Siguiente Ronda', en: 'Next Round' },

    // ── Game Over ──
    'gameOver.title': { es: 'FIN DEL JUEGO', en: 'GAME OVER' },
    'gameOver.winner': { es: '¡Ganador:', en: 'Winner:' },
    'gameOver.draw': { es: '¡Empate final!', en: 'Final draw!' },
    'gameOver.mainMenu': { es: 'Menú Principal', en: 'Main Menu' },

    // ── Validation Messages ──
    'rules.negPrediction': { es: 'La predicción no puede ser negativa', en: 'Prediction cannot be negative' },
    'rules.maxPrediction': { es: 'No puedes predecir más de {n} bazas', en: 'You cannot predict more than {n} tricks' },
    'rules.sandwichRule': { es: 'La suma total no puede ser {n}. No puedes decir {v}', en: 'The total cannot be {n}. You cannot say {v}' },

    // ── Generic ──
    'generic.player': { es: 'Jugador', en: 'Player' },
    'generic.hostName': { es: 'Anfitrión', en: 'Host' },
    'generic.cancel': { es: 'Cancelar', en: 'Cancel' },

    // ── Language Toggle ──
    'lang.switch': { es: 'EN', en: 'ES' },
    'lang.tooltip': { es: 'Switch to English', en: 'Cambiar a Español' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang, params?: Record<string, string | number>): string {
    const entry = translations[key];
    let text = entry[lang];
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(`{${k}}`, String(v));
        }
    }
    return text;
}

export default translations;
