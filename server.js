const express = require('express');
const app = express();
const path = require('path');
const https = require('https');
const socketIO = require('socket.io');
const { exec } = require('child_process');
const config = require('./config');
const gameState = require('./state/gameState');
const { handleRevealAnswer } = require('./handlers/socketHandlers');
const { handlePlayerJoin, handleStartGame, startNewQuestion, getCurrentGameState } = require('./handlers/playerHandlers');
const { broadcastScores, emitPlayerCount } = require('./utils/broadcast');

// Track authenticated admin sockets
const authenticatedAdmins = new Set();

app.use((req, res, next) => {
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Initialize game state with config
gameState.timeLeft = config.QUESTION_TIMER;

// Create HTTPS server
const server = https.createServer(config.SSL_OPTIONS, app);
const io = socketIO(server);

io.on('connection', (socket) => {
    socket.on('spectator-join', () => {
        socket.join('spectators');
        if (gameState.isGameStarted && gameState.currentQuestion) {
            const questionData = {
                questionNumber: gameState.currentQuestionIndex + 1,
                totalQuestions: gameState.questions.length,
                questionText: gameState.currentQuestion.question,
                choices: gameState.currentQuestion.type === 'year' ? [] : gameState.currentQuestion.choices,
                questionType: gameState.currentQuestion.type || 'multiple-choice'
            };
            socket.emit('new-question', questionData);
        }
    });

    socket.on('player-connect', (data) => handlePlayerJoin(io, socket, data.name));
    
    socket.on('validate-name', (name) => {
        const validation = require('./utils/game').validatePlayerName(name);
        socket.emit('name-validation-result', validation);
    });
    
    socket.on('admin-login', (password) => {
        if (password === config.ADMIN_PASSWORD) {
            authenticatedAdmins.add(socket.id);
            gameState.adminSocket = socket;
            socket.join('admin');
            socket.emit('admin-login-response', { success: true });
        } else {
            socket.emit('admin-login-response', { success: false });
        }
    });

    socket.on('start-game', () => {
        if (authenticatedAdmins.has(socket.id)) {
            handleStartGame(io, socket);
        }
    });

    socket.on('next-question', () => {
        if (authenticatedAdmins.has(socket.id)) {
            if (gameState.currentQuestionIndex + 1 < gameState.questions.length) {
                gameState.currentQuestionIndex++;
                startNewQuestion(io);
            } else {
                // Just notify admin that we're at the end, allowing them to use 'Avsluta tävlingen'
                socket.emit('last-question-reached');
            }
        }
    });

    socket.on('end-game', () => {
        if (authenticatedAdmins.has(socket.id)) {
            // Get all players (both connected and disconnected)
            const connectedPlayers = Array.from(gameState.players.values());
            const disconnectedPlayers = Array.from(gameState.disconnectedPlayers.values());
            const allPlayers = [...connectedPlayers, ...disconnectedPlayers];

            // Sort players by score and handle year question tiebreaker
            const finalPlayers = allPlayers.sort((a, b) => {
                if (a.score === b.score) {
                    const aProximity = gameState.yearProximities.get(a.name) || Infinity;
                    const bProximity = gameState.yearProximities.get(b.name) || Infinity;
                    return aProximity - bProximity;
                }
                return b.score - a.score;
            }).map(player => ({
                name: player.name,
                score: player.score,
                connected: !gameState.disconnectedPlayers.has(player.name)
            }));

            // Send game-over event to all clients
            io.emit('game-over', finalPlayers);

            // Reset game state
            gameState.isGameStarted = false;
            gameState.playerAnswers.clear();
            gameState.yearProximities.clear();
            gameState.currentQuestionIndex = -1;
            gameState.currentQuestion = null;
            io.emit('game-ended');
        }
    });

    socket.on('reveal-answer', () => {
        if (authenticatedAdmins.has(socket.id)) {
            handleRevealAnswer(io, socket);
        }
    });

    socket.on('submit-answer', (answer) => {
        const player = gameState.players.get(socket.id);
        if (player && gameState.isGameStarted && !gameState.playerAnswers.get(gameState.currentQuestionIndex)?.has(player.name)) {
            const answers = gameState.playerAnswers.get(gameState.currentQuestionIndex) || new Map();
            answers.set(player.name, { answer, timestamp: Date.now() });
            gameState.playerAnswers.set(gameState.currentQuestionIndex, answers);
            
            // Send confirmation back to player with hasAnswered flag
            socket.emit('answer-confirmed', {
                answer: answer,
                hasAnswered: true,
                questionIndex: gameState.currentQuestionIndex
            });
            
            // Notify admin
            io.to('admin').emit('player-answered', { 
                playerName: player.name,
                answer: answer
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket === gameState.adminSocket) {
            gameState.adminSocket = null;
            authenticatedAdmins.delete(socket.id);
        } else {
            const player = gameState.players.get(socket.id);
            if (player && gameState.isGameStarted) {  // Only track disconnects during active game
                // Move player to disconnectedPlayers instead of deleting
                gameState.disconnectedPlayers.set(socket.id, {
                    name: player.name,
                    score: player.score
                });
                gameState.players.delete(socket.id);
                io.to('admin').emit('player-left', { id: socket.id });
                emitPlayerCount(io);
                broadcastScores(io); // Broadcast updated scores after disconnect
            }
        }
    });

    socket.on('reconnect-player', (sessionData) => {
        const playerSession = gameState.playerSessions.get(sessionData.name);
        if (playerSession) {
            playerSession.sessionId = socket.id;
            
            // Check if player was disconnected and restore their score
            let score = 0;
            Array.from(gameState.disconnectedPlayers.entries()).forEach(([id, player]) => {
                if (player.name === sessionData.name) {
                    score = player.score;
                    gameState.disconnectedPlayers.delete(id);
                }
            });
            
            gameState.players.set(socket.id, {
                name: sessionData.name,
                score: score
            });
            
            socket.join('players');
            socket.emit('player-welcome', {
                name: sessionData.name,
                gameInProgress: gameState.isGameStarted,
                sessionId: socket.id,
                score: score
            });

            io.to('admin').emit('player-joined', {
                id: socket.id,
                name: sessionData.name,
                score: score
            });

            emitPlayerCount(io);
            broadcastScores(io);

            // Send current game state if game is in progress
            if (gameState.isGameStarted && gameState.currentQuestion) {
                const currentState = getCurrentGameState(sessionData.name);
                if (currentState) {
                    socket.emit('game-state', currentState);
                }
            }
        } else {
            socket.emit('connection-error', 'Session expired. Please enter your name again.');
        }
    });

    socket.on('restart-server', () => {
        if (authenticatedAdmins.has(socket.id)) {
            io.emit('restart-initiated');
            setTimeout(() => {
                process.exit(0); // PM2 will restart the server
            }, 1000);
        }
    });

    socket.on('shutdown-server', () => {
        if (authenticatedAdmins.has(socket.id)) {
            io.emit('shutdown-initiated');
            setTimeout(() => {
                process.exit(1); // Exit with error code to prevent PM2 restart
            }, 1000);
        }
    });
});

// Kill any existing process on the port before starting
exec(`lsof -ti:${config.PORT} | xargs kill -9`, (error) => {
    server.listen(config.PORT, () => {
        console.log(`HTTPS Server running on port ${config.PORT}`);
    });
});
