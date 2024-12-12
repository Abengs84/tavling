const gameState = require('../state/gameState');
const { calculateYearPoints } = require('../utils/scoring');
const { broadcastScores } = require('../utils/broadcast');
const { stopTimer } = require('../utils/timer');
const { findPlayer, updatePlayerScore } = require('../utils/game');
const config = require('../config');

function handleRevealAnswer(io, socket) {
    stopTimer();
    io.emit('timer-end');
    
    if (gameState.currentQuestion) {
        const results = [];
        const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
        const isYearQuestion = gameState.currentQuestion.type === 'year';
        
        if (questionAnswers) {
            questionAnswers.forEach((answerData, playerName) => {
                let points = 0;
                let isCorrect = false;

                if (isYearQuestion) {
                    const yearResult = calculateYearPoints(answerData.answer, gameState.currentQuestion.correctAnswer);
                    points = yearResult.points;
                    isCorrect = points === config.YEAR_POINTS;
                    gameState.yearProximities.set(playerName, yearResult.proximity);
                } else {
                    isCorrect = answerData.answer === gameState.currentQuestion.correctAnswer;
                    points = isCorrect ? config.POINTS_FOR_CORRECT : 0;
                }
                
                const { player, isConnected } = findPlayer(playerName);
                if (player) {
                    const totalScore = updatePlayerScore(playerName, points);
                    
                    results.push({
                        playerName: playerName,
                        answer: answerData.answer,
                        correct: isCorrect,
                        points: points,
                        totalScore: totalScore,
                        connected: isConnected
                    });
                }
            });
        }

        // Broadcast updated scores to show current state
        broadcastScores(io);

        // Send results to all clients
        const revealData = {
            correctAnswer: gameState.currentQuestion.correctAnswer,
            results: results,
            isLastQuestion: gameState.currentQuestionIndex === gameState.questions.length - 1
        };

        io.emit('answer-revealed', revealData);
    }
}

module.exports = {
    handleRevealAnswer
};
