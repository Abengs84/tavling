const gameState = {
    questions: [],
    currentQuestionIndex: -1,
    currentQuestion: null,
    players: new Map(), // Map<socketId, {name, score}>
    disconnectedPlayers: new Map(), // Track disconnected players and their scores
    playerAnswers: new Map(), // Map<questionIndex, Map<playerName, {answer}>
    isGameStarted: false,
    adminSocket: null,
    playerSessions: new Map(), // Map<name, {sessionId, score}>
    timerInterval: null,
    timerStartTime: null,  // Track when timer started
    timeLeft: null,  // Will be set from config
    yearProximities: new Map(), // Track year proximities for tiebreaker
    finalResults: null // Store final results for reconnecting players
};

module.exports = gameState;
