const socket = io();
let playerName = '';

// Check for existing session on page load
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = decodeURIComponent(error);
        errorMessage.style.display = 'block';
    }

    // Check for existing session
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        socket.emit('verify-session', sessionData);
    }
};

// Real-time name validation
document.getElementById('playerName').addEventListener('input', function(e) {
    const name = e.target.value.trim();
    if (name.length >= 3) {
        socket.emit('validate-name', name);
    }
});

socket.on('name-validation-result', function(result) {
    const errorMessage = document.getElementById('errorMessage');
    if (!result.valid) {
        errorMessage.textContent = result.error;
        errorMessage.style.display = 'block';
    } else {
        errorMessage.style.display = 'none';
    }
});

function showWelcomeScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'block';
}

function updateOtherPlayersCount(count) {
    const countElement = document.getElementById('otherPlayersCount');
    if (count === 0) {
        countElement.textContent = 'Inga andra spelare har anslutit än';
    } else if (count === 1) {
        countElement.textContent = '1 annan spelare har anslutit';
    } else {
        countElement.textContent = `${count} andra spelare har anslutit`;
    }
}

function joinGame() {
    const nameInput = document.getElementById('playerName').value.trim();
    if (nameInput) {
        // Hide any existing error message when attempting to join
        document.getElementById('errorMessage').style.display = 'none';
        socket.emit('player-connect', { name: nameInput });
    }
}

socket.on('session-verified', (isValid) => {
    if (isValid) {
        // Valid session exists, redirect to game
        socket.close();
        window.location.href = '/game.html';
    } else {
        // Invalid session, clear it
        localStorage.removeItem('quizSession');
    }
});

socket.on('player-welcome', (data) => {
    playerName = data.name;
    
    // Save session data
    localStorage.setItem('quizSession', JSON.stringify({
        name: playerName,
        sessionId: data.sessionId,
        score: data.score || 0
    }));

    document.getElementById('welcomePlayerName').textContent = playerName;
    
    if (data.gameInProgress) {
        // If game is already in progress, go directly to game page
        socket.close(); // Close socket before redirect
        window.location.href = '/game.html';
    } else {
        showWelcomeScreen();
    }
});

socket.on('game-started', () => {
    // Game is starting, go to game page
    socket.close(); // Close socket before redirect
    window.location.href = '/game.html';
});

socket.on('players-updated', (count) => {
    updateOtherPlayersCount(Math.max(0, count - 1)); // Subtract 1 to exclude current player
});

socket.on('connection-error', function(error) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = error;
    errorMessage.style.display = 'block';
});

// Handle Enter key in name input
document.getElementById('playerName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        joinGame();
    }
});
