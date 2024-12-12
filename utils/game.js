const gameState = require('../state/gameState');
const path = require('path');
const fs = require('fs');

function loadQuestions() {
    const questionsPath = path.join(__dirname, '..', 'questions.json');
    const questionsData = fs.readFileSync(questionsPath, 'utf8');
    return JSON.parse(questionsData).questions;
}

function hasPlayerAnswered(playerName) {
    if (!gameState.playerAnswers.has(gameState.currentQuestionIndex)) {
        return false;
    }
    const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
    return questionAnswers.has(playerName);
}

function getPlayerAnswer(playerName) {
    if (!gameState.playerAnswers.has(gameState.currentQuestionIndex)) {
        return null;
    }
    const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
    return questionAnswers.get(playerName);
}

function validatePlayerName(name) {
    if (name.length < 3) {
        return { valid: false, error: 'Namnet måste vara minst 3 tecken långt' };
    }
    if (!/^[a-zA-ZåäöÅÄÖ0-9 ]+$/.test(name)) {
        return { valid: false, error: 'Namnet får endast innehålla bokstäver, siffror och mellanslag' };
    }
    const existingNames = Array.from(gameState.players.values()).map(p => p.name.toLowerCase());
    const disconnectedNames = Array.from(gameState.disconnectedPlayers.values()).map(p => p.name.toLowerCase());
    if (existingNames.includes(name.toLowerCase()) || disconnectedNames.includes(name.toLowerCase())) {
        return { valid: false, error: 'Detta namn är redan taget' };
    }
    return { valid: true };
}

function findPlayer(playerName) {
    // Check connected players first
    for (const [_, p] of gameState.players.entries()) {
        if (p.name === playerName) {
            return { player: p, isConnected: true };
        }
    }

    // Check disconnected players
    for (const [_, p] of gameState.disconnectedPlayers.entries()) {
        if (p.name === playerName) {
            return { player: p, isConnected: false };
        }
    }

    return { player: null, isConnected: false };
}

function updatePlayerScore(playerName, points) {
    const { player, isConnected } = findPlayer(playerName);
    if (player) {
        player.score += points;
        
        if (isConnected) {
            const session = gameState.playerSessions.get(playerName);
            if (session) {
                session.score = player.score;
            }
        }
        return player.score;
    }
    return null;
}

module.exports = {
    loadQuestions,
    hasPlayerAnswered,
    getPlayerAnswer,
    validatePlayerName,
    findPlayer,
    updatePlayerScore
};
