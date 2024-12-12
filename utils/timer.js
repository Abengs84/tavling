const gameState = require('../state/gameState');
const config = require('../config');

function startTimer(io) {
    gameState.timerStartTime = Date.now();
    gameState.timeLeft = config.QUESTION_TIMER;
    io.emit('timer-start', config.QUESTION_TIMER);
    
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        io.emit('timer-tick', gameState.timeLeft);
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            io.emit('timer-end', {
                currentQuestionIndex: gameState.currentQuestionIndex,
                playerAnswers: gameState.playerAnswers.get(gameState.currentQuestionIndex)
            });
            // Auto-reveal answer when time is up
            setTimeout(() => {
                io.to('admin').emit('time-up');
            }, 1000);
        }
    }, 1000);
}

function getCurrentTimerState() {
    if (!gameState.timerStartTime || !gameState.isGameStarted) {
        return null;
    }
    
    const elapsed = Math.floor((Date.now() - gameState.timerStartTime) / 1000);
    const remaining = Math.max(0, config.QUESTION_TIMER - elapsed);
    
    return {
        timeLeft: remaining,
        totalTime: config.QUESTION_TIMER
    };
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

module.exports = {
    startTimer,
    getCurrentTimerState,
    stopTimer
};
