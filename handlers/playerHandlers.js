const gameState = require('../state/gameState');
const { validatePlayerName, loadQuestions } = require('../utils/game');
const { broadcastScores, emitPlayerCount } = require('../utils/broadcast');
const { startTimer } = require('../utils/timer');

function handlePlayerJoin(io, socket, playerName) {
    const validation = validatePlayerName(playerName);
    if (!validation.valid) {
        socket.emit('join-error', validation.error);
        return;
    }

    // Check if player is reconnecting
    const existingSession = gameState.playerSessions.get(playerName);
    const isDisconnected = Array.from(gameState.disconnectedPlayers.values()).some(p => p.name === playerName);
    
    if (existingSession || isDisconnected) {
        socket.emit('join-error', 'Du är redan med i spelet. Använd återanslut om du tappat anslutningen.');
        return;
    }

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

    socket.join('players');
    socket.emit('player-welcome', {
        name: playerName,
        gameInProgress: gameState.isGameStarted,
        sessionId: socket.id,
        score: 0,
        currentQuestionIndex: gameState.currentQuestionIndex
    });

    io.to('admin').emit('player-joined', {
        id: socket.id,
        name: playerName,
        score: 0
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
