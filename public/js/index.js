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
        try {
            const sessionData = JSON.parse(savedSession);
            // Only verify if we have both name and sessionId
            if (sessionData.name && sessionData.sessionId) {
                // Set the session in socket auth
                socket.auth = { session: sessionData };
                
                // Show reconnecting message
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('welcomeScreen').style.display = 'block';
                document.getElementById('welcomePlayerName').textContent = sessionData.name;
                document.getElementById('otherPlayersCount').textContent = 'Återansluter...';
                document.querySelector('.pulse').style.display = 'none';
                
                // Attempt to reconnect
                socket.emit('player-connect', { name: sessionData.name });
            } else {
                localStorage.removeItem('quizSession');
            }
        } catch (e) {
            localStorage.removeItem('quizSession');
        }
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
    document.querySelector('.pulse').style.display = 'block';
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

function showReconnectPrompt(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.innerHTML = `
        ${message}<br>
        <button onclick="handleReconnect()" class="reconnect-button">Återanslut</button>
    `;
    errorMessage.style.display = 'block';
}

function handleReconnect() {
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            socket.auth = { session: sessionData };
            socket.emit('player-connect', { name: sessionData.name });
        } catch (e) {
            localStorage.removeItem('quizSession');
            location.reload();
        }
    } else {
        location.reload();
    }
}

function joinGame() {
    const nameInput = document.getElementById('playerName').value.trim();
    if (nameInput) {
        // Hide any existing error message when attempting to join
        document.getElementById('errorMessage').style.display = 'none';
        
        // Show loading state
        const joinButton = document.getElementById('joinButton');
        const originalText = joinButton.textContent;
        joinButton.disabled = true;
        joinButton.textContent = 'Ansluter...';
        
        // Set a timeout to re-enable the button if no response
        const timeout = setTimeout(() => {
            joinButton.disabled = false;
            joinButton.textContent = originalText;
            const errorMessage = document.getElementById('errorMessage');
            errorMessage.textContent = 'Kunde inte ansluta till spelet. Försök igen.';
            errorMessage.style.display = 'block';
        }, 5000);
        
        // Update socket auth with current session if exists
        const savedSession = localStorage.getItem('quizSession');
        if (savedSession) {
            try {
                const sessionData = JSON.parse(savedSession);
                socket.auth = { session: sessionData };
            } catch (e) {
                localStorage.removeItem('quizSession');
            }
        }
        
        socket.emit('player-connect', { name: nameInput });
        
        // Handle join error
        socket.once('join-error', (error) => {
            clearTimeout(timeout);
            joinButton.disabled = false;
            joinButton.textContent = originalText;
            const errorMessage = document.getElementById('errorMessage');
            errorMessage.textContent = error;
            errorMessage.style.display = 'block';
            
            // Show login screen again if error
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('loginScreen').style.display = 'block';
        });

        // Handle reconnection prompt
        socket.once('reconnect-prompt', (data) => {
            clearTimeout(timeout);
            joinButton.disabled = false;
            joinButton.textContent = originalText;
            showReconnectPrompt(data.message);
        });
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
        socket.auth = {}; // Clear socket auth
        
        // Show login screen again
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'block';
    }
});

socket.on('player-welcome', (data) => {
    playerName = data.name;
    
    // Clear any loading state
    const joinButton = document.getElementById('joinButton');
    if (joinButton) {
        joinButton.disabled = false;
        joinButton.textContent = 'Anslut';
    }
    
    // Save complete session data
    const sessionData = {
        name: playerName,
        sessionId: data.sessionId,
        score: data.score || 0,
        currentQuestionIndex: data.currentQuestionIndex,
        gameInProgress: data.gameInProgress
    };
    
    // Update both localStorage and socket auth
    localStorage.setItem('quizSession', JSON.stringify(sessionData));
    socket.auth = { session: sessionData };

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
    // Update session with game state before redirecting
    const sessionData = JSON.parse(localStorage.getItem('quizSession'));
    if (sessionData) {
        sessionData.gameInProgress = true;
        sessionData.currentQuestionIndex = 0;
        localStorage.setItem('quizSession', JSON.stringify(sessionData));
        socket.auth = { session: sessionData };
    }
    
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
    localStorage.removeItem('quizSession');
    socket.auth = {}; // Clear socket auth
    
    // Reset join button state
    const joinButton = document.getElementById('joinButton');
    if (joinButton) {
        joinButton.disabled = false;
        joinButton.textContent = 'Anslut';
    }
    
    // Show login screen again
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
});

// Handle Enter key in name input
document.getElementById('playerName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        joinGame();
    }
});
