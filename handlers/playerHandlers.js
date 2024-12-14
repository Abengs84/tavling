const gameState = require('../state/gameState');
const { validatePlayerName, loadQuestions } = require('../utils/game');
const { broadcastScores, emitPlayerCount } = require('../utils/broadcast');
const { startTimer } = require('../utils/timer');

function cleanupPlayerSession(playerName) {
    // Remove from playerSessions
    gameState.playerSessions.delete(playerName);

    // Remove from players and notify admin
    for (const [socketId, player] of gameState.players.entries()) {
        if (player.name === playerName) {
            gameState.players.delete(socketId);
            // Notify admin about player removal
            if (gameState.adminSocket) {
                gameState.adminSocket.emit('player-left', { id: socketId });
            }
            break;
        }
    }

    // Remove from disconnectedPlayers
    for (const [socketId, player] of gameState.disconnectedPlayers.entries()) {
        if (player.name === playerName) {
            gameState.disconnectedPlayers.delete(socketId);
            // Notify admin about player removal
            if (gameState.adminSocket) {
                gameState.adminSocket.emit('player-left', { id: socketId });
            }
            break;
        }
    }
}

function handlePlayerJoin(io, socket, playerName) {
    const validation = validatePlayerName(playerName);
    if (!validation.valid) {
        socket.emit('join-error', validation.error);
        return;
    }

    // Check for existing session
    const existingSession = gameState.playerSessions.get(playerName);
    const isDisconnected = Array.from(gameState.disconnectedPlayers.values()).some(p => p.name === playerName);
    
    // Check if this is the same player trying to reconnect
    const savedSession = socket.handshake.auth.session;
    const isReconnecting = savedSession && savedSession.name === playerName;
    
    if ((existingSession || isDisconnected) && !isReconnecting) {
        // Different player trying to use the same name
        socket.emit('join-error', 'Detta namn är redan taget');
        return;
    }

    // Clean up any existing session for this player
    cleanupPlayerSession(playerName);

    // Handle reconnection
    if (isReconnecting) {
        let score = 0;
        let hasAnswered = false;

        // Check if player was disconnected and restore their score
        Array.from(gameState.disconnectedPlayers.entries()).forEach(([id, player]) => {
            if (player.name === playerName) {
                score = player.score;
                gameState.disconnectedPlayers.delete(id);
            }
        });

        // Check if player has answered current question
        if (gameState.currentQuestionIndex >= 0) {
            const currentAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
            hasAnswered = currentAnswers?.has(playerName) || false;
        }

        // Update session
        gameState.playerSessions.set(playerName, {
            sessionId: socket.id,
            score: score,
            currentQuestionIndex: gameState.currentQuestionIndex,
            hasAnswered: hasAnswered
        });

        // Update players map
        gameState.players.set(socket.id, {
            name: playerName,
            score: score
        });
    } else {
        // Create new player session
        gameState.players.set(socket.id, {
            name: playerName,
            score: 0
        });

        gameState.playerSessions.set(playerName, {
            sessionId: socket.id,
            score: 0,
            currentQuestionIndex: gameState.currentQuestionIndex,
            hasAnswered: false
        });
    }

    // Store session info in socket for future reference
    socket.handshake.auth.session = {
        name: playerName,
        sessionId: socket.id
    };

    socket.join('players');
    socket.emit('player-welcome', {
        name: playerName,
        gameInProgress: gameState.isGameStarted,
        sessionId: socket.id,
        score: gameState.players.get(socket.id).score,
        currentQuestionIndex: gameState.currentQuestionIndex
    });

    io.to('admin').emit('player-joined', {
        id: socket.id,
        name: playerName,
        score: gameState.players.get(socket.id).score
    });

    emitPlayerCount(io);
    broadcastScores(io);
}

function handleStartGame(io, socket) {
    // Reset scores for connected players
    gameState.players.forEach(player => {
        player.score = 0;
        const session = gameState.playerSessions.get(player.name);
        if (session) {
            session.score = 0;
            session.currentQuestionIndex = 0;
            session.hasAnswered = false;
        }
    });

    // Reset scores for disconnected players but don't clear them
    gameState.disconnectedPlayers.forEach(player => {
        player.score = 0;
    });

    gameState.currentQuestionIndex = 0;
    gameState.questions = loadQuestions();
    gameState.isGameStarted = true;
    gameState.playerAnswers.clear();
    gameState.yearProximities.clear();
    
    broadcastScores(io);
    io.emit('game-started');
    
    setTimeout(() => {
        startNewQuestion(io);
    }, 1000);
}

function startNewQuestion(io) {
    gameState.currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    gameState.playerAnswers.set(gameState.currentQuestionIndex, new Map());

    // Update all player sessions with new question index
    gameState.playerSessions.forEach(session => {
        session.currentQuestionIndex = gameState.currentQuestionIndex;
        session.hasAnswered = false;
    });

    const isYearQuestion = gameState.currentQuestion.type === 'year';
    const questionType = isYearQuestion ? 'year' : 'multiple-choice';

    const questionData = {
        questionNumber: gameState.currentQuestionIndex + 1,
        totalQuestions: gameState.questions.length,
        questionText: gameState.currentQuestion.question,
        choices: isYearQuestion ? [] : gameState.currentQuestion.choices,
        questionType: questionType
    };

    // Send to admin with correct answer
    io.to('admin').emit('new-question', {
        ...questionData,
        correctAnswer: gameState.currentQuestion.correctAnswer
    });

    // Send to players and spectators without correct answer
    io.to('players').emit('new-question', questionData);
    io.to('spectators').emit('new-question', questionData);

    startTimer(io);
}

function getCurrentGameState(playerName) {
    if (!gameState.isGameStarted || !gameState.currentQuestion) {
        return null;
    }

    const session = gameState.playerSessions.get(playerName);
    const answers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
    const hasAnswered = answers?.has(playerName) || false;
    const answer = hasAnswered ? answers.get(playerName).answer : null;

    // Update session with current state
    if (session) {
        session.hasAnswered = hasAnswered;
        session.currentQuestionIndex = gameState.currentQuestionIndex;
    }

    return {
        currentQuestionIndex: gameState.currentQuestionIndex,
        questionNumber: gameState.currentQuestionIndex + 1,
        totalQuestions: gameState.questions.length,
        questionText: gameState.currentQuestion.question,
        choices: gameState.currentQuestion.type === 'year' ? [] : gameState.currentQuestion.choices,
        questionType: gameState.currentQuestion.type || 'multiple-choice',
        hasAnswered: hasAnswered,
        answer: answer,
        score: session?.score || 0
    };
}

module.exports = {
    handlePlayerJoin,
    handleStartGame,
    startNewQuestion,
    getCurrentGameState
};
