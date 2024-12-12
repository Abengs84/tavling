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
    if (existingSession) {
        socket.emit('join-error', 'Du är redan med i spelet. Använd återanslut om du tappat anslutningen.');
        return;
    }

    gameState.players.set(socket.id, {
        name: playerName,
        score: 0
    });

    gameState.playerSessions.set(playerName, {
        sessionId: socket.id,
        score: 0
    });

    socket.join('players');
    socket.emit('player-welcome', {
        name: playerName,
        gameInProgress: gameState.isGameStarted,
        sessionId: socket.id
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

    const answers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
    const hasAnswered = answers?.has(playerName) || false;
    const answer = hasAnswered ? answers.get(playerName).answer : null;

    return {
        currentQuestionIndex: gameState.currentQuestionIndex,
        questionNumber: gameState.currentQuestionIndex + 1,
        totalQuestions: gameState.questions.length,
        questionText: gameState.currentQuestion.question,
        choices: gameState.currentQuestion.type === 'year' ? [] : gameState.currentQuestion.choices,
        questionType: gameState.currentQuestion.type || 'multiple-choice',
        hasAnswered: hasAnswered,
        answer: answer
    };
}

module.exports = {
    handlePlayerJoin,
    handleStartGame,
    startNewQuestion,
    getCurrentGameState
};
