const gameState = require('../state/gameState');

function broadcastScores(io) {
    // Get connected players
    const connectedPlayers = Array.from(gameState.players.entries()).map(([id, player]) => ({
        id,
        name: player.name,
        score: player.score || 0,
        connected: true
    }));

    // Always include disconnected players if they exist
    const disconnectedPlayers = Array.from(gameState.disconnectedPlayers.entries())
        .map(([id, player]) => ({
            id,
            name: player.name,
            score: player.score || 0,
            connected: false
        }));

    // Send both connected and disconnected players
    io.to('admin').emit('scores-updated', [...connectedPlayers, ...disconnectedPlayers]);
}

function emitPlayerCount(io) {
    io.emit('players-updated', gameState.players.size);
}

module.exports = {
    broadcastScores,
    emitPlayerCount
};
