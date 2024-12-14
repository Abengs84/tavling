const socket = io();
let gameStarted = false;
let answerRevealed = false;
let correctAnswer = null;
const playerAnswers = new Map();

// Check for existing admin session on load
window.onload = function() {
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
        try {
            const sessionData = JSON.parse(adminSession);
            if (sessionData.password) {
                // Auto-login with stored password
                socket.emit('admin-login', sessionData.password);
                
                // Restore game state if it exists
                if (sessionData.gameState) {
                    gameStarted = sessionData.gameState.gameStarted;
                    answerRevealed = sessionData.gameState.answerRevealed;
                    correctAnswer = sessionData.gameState.correctAnswer;
                    if (sessionData.gameState.playerAnswers) {
                        sessionData.gameState.playerAnswers.forEach((value, key) => {
                            playerAnswers.set(key, value);
                        });
                    }
                }
            }
        } catch (e) {
            localStorage.removeItem('adminSession');
        }
    }
};

function updateAdminSessionStorage() {
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
        try {
            const sessionData = JSON.parse(adminSession);
            sessionData.gameState = {
                gameStarted,
                answerRevealed,
                correctAnswer,
                playerAnswers: Array.from(playerAnswers.entries())
            };
            localStorage.setItem('adminSession', JSON.stringify(sessionData));
        } catch (e) {
            console.error('Failed to update admin session:', e);
        }
    }
}

function enableOnlyStartGame() {
    document.getElementById('startGame').disabled = false;
    document.getElementById('revealAnswer').disabled = true;
    document.getElementById('nextQuestion').disabled = true;
    document.getElementById('answersList').innerHTML = '';
    playerAnswers.clear();
    correctAnswer = null;
    answerRevealed = false;
}

function updateTimerBar(timeLeft, totalTime) {
    const timerBar = document.getElementById('timerBar');
    
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    timerBar.offsetHeight;
    
    if (timeLeft > 0) {
        requestAnimationFrame(() => {
            timerBar.style.transition = `width ${timeLeft}s linear`;
            timerBar.style.width = '0%';
        });
    } else {
        timerBar.style.width = '0%';
    }
}

function stopTimer() {
    const timerBar = document.getElementById('timerBar');
    const currentWidth = getComputedStyle(timerBar).width;
    timerBar.style.transition = 'none';
    timerBar.style.width = currentWidth;
}

function updatePlayerList(players) {
    const playersList = document.getElementById('playersList');
    // Clear the list first
    playersList.innerHTML = '';
    
    // Create a map of players by name to handle duplicates
    const playerMap = new Map();
    players.forEach(player => {
        // If player already exists, only update if this instance is connected
        const existing = playerMap.get(player.name);
        if (!existing || (!existing.connected && player.connected)) {
            playerMap.set(player.name, player);
        }
    });

    // Add unique players to the list
    playerMap.forEach(player => {
        const li = document.createElement('li');
        li.id = `player-${player.id}`;
        const disconnectedClass = player.connected === false ? 'disconnected' : '';
        const disconnectedText = player.connected === false ? ' (frånkopplad)' : '';
        li.className = disconnectedClass;
        li.innerHTML = `${player.name}${disconnectedText} <span class="player-score">${player.score} poäng</span>`;
        playersList.appendChild(li);
    });
}

function updateAnswersList() {
    const answersList = document.getElementById('answersList');
    answersList.innerHTML = '';
    
    Array.from(playerAnswers.values()).forEach(answer => {
        const div = document.createElement('div');
        div.className = 'player-answer';
        
        let answerStatus = '';
        if (answerRevealed && correctAnswer !== null) {
            const isCorrect = answer.answer === correctAnswer;
            answerStatus = `<span class="answer-status ${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '✓' : '✗'}
            </span>`;
        }
        
        div.innerHTML = `
            <div class="answer-details">
                <strong>${answer.playerName}</strong>
                <span class="answer-text"> ${answer.answer}</span>
                ${answerStatus}
            </div>
        `;
        answersList.appendChild(div);
    });
}

// Event Listeners
document.getElementById('loginButton').addEventListener('click', () => {
    const password = document.getElementById('password').value;
    socket.emit('admin-login', password);
    // Store password for auto-login on refresh
    localStorage.setItem('adminSession', JSON.stringify({ 
        password,
        gameState: null
    }));
});

document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('loginButton').click();
    }
});

document.getElementById('startGame').addEventListener('click', () => {
    socket.emit('start-game');
    gameStarted = true;
    updateAdminSessionStorage();
});

document.getElementById('revealAnswer').addEventListener('click', () => {
    stopTimer();
    socket.emit('reveal-answer');
});

document.getElementById('nextQuestion').addEventListener('click', () => {
    if (document.getElementById('nextQuestion').textContent === 'Avsluta spelet') {
        socket.emit('end-game');
        document.getElementById('nextQuestion').disabled = true;
        document.getElementById('nextQuestion').textContent = 'Nästa fråga';
    } else {
        socket.emit('next-question');
        document.getElementById('nextQuestion').disabled = true;
    }
});

document.getElementById('restartServer').addEventListener('click', () => {
    if (confirm('Är du säker på att du vill starta om servern? Alla anslutna spelare kommer att kopplas bort.')) {
        socket.emit('restart-server');
    }
});

document.getElementById('shutdownServer').addEventListener('click', () => {
    if (confirm('Är du säker på att du vill stänga av servern? Alla anslutna spelare kommer att kopplas bort och servern måste startas om manuellt.')) {
        socket.emit('shutdown-server');
    }
});

// Socket Event Handlers
socket.on('admin-login-response', (response) => {
    if (response.success) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'grid';
        socket.emit('admin-connect');
    } else {
        const errorElement = document.getElementById('loginError');
        errorElement.textContent = 'Invalid password';
        errorElement.style.display = 'block';
        document.getElementById('password').value = '';
        localStorage.removeItem('adminSession');
    }
});

socket.on('admin-connected', () => {
    console.log('Connected as admin');
    // Don't reset game state on reconnect, wait for game-state event
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'grid';
});

socket.on('game-state', (data) => {
    gameStarted = true;
    correctAnswer = data.correctAnswer;
    
    // Update game progress
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    // Update question details with proper structure
    const questionDetails = document.getElementById('questionDetails');
    questionDetails.innerHTML = '';

    // Add question text
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = data.questionText;
    questionDetails.appendChild(questionText);

    // Add alternatives
    if (data.choices && data.choices.length > 0) {
        const alternatives = document.createElement('div');
        alternatives.className = 'alternatives';
        alternatives.innerHTML = `Alternativ: ${data.choices.map(choice => 
            choice === correctAnswer ? `<u>${choice}</u>` : choice
        ).join(', ')}`;
        questionDetails.appendChild(alternatives);
    }

    // Add correct answer
    const correctAnswerDiv = document.createElement('div');
    correctAnswerDiv.className = 'correct-answer';
    correctAnswerDiv.innerHTML = `Rätt svar: <u>${correctAnswer}</u>`;
    questionDetails.appendChild(correctAnswerDiv);

    // Set up button states
    document.getElementById('startGame').disabled = true;
    document.getElementById('nextQuestion').disabled = false;
    document.getElementById('revealAnswer').disabled = false;

    // If it's the last question, update button text
    if (data.isLastQuestion) {
        document.getElementById('nextQuestion').textContent = 'Avsluta spelet';
    }

    updateAdminSessionStorage();
});

socket.on('new-question', (data) => {
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    // Store correct answer for underlining
    correctAnswer = data.correctAnswer;
    
    // Update question details with proper structure
    const questionDetails = document.getElementById('questionDetails');
    questionDetails.innerHTML = '';

    // Add question text
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = data.questionText;
    questionDetails.appendChild(questionText);

    // Add alternatives
    if (data.choices && data.choices.length > 0) {
        const alternatives = document.createElement('div');
        alternatives.className = 'alternatives';
        alternatives.innerHTML = `Alternativ: ${data.choices.map(choice => 
            choice === correctAnswer ? `<u>${choice}</u>` : choice
        ).join(', ')}`;
        questionDetails.appendChild(alternatives);
    }

    // Add correct answer
    const correctAnswerDiv = document.createElement('div');
    correctAnswerDiv.className = 'correct-answer';
    correctAnswerDiv.innerHTML = `Rätt svar: <u>${correctAnswer}</u>`;
    questionDetails.appendChild(correctAnswerDiv);

    // Reset answers list and state
    document.getElementById('answersList').innerHTML = '';
    playerAnswers.clear();
    answerRevealed = false;
    
    // Set up button states
    document.getElementById('startGame').disabled = true;
    document.getElementById('nextQuestion').disabled = true;
    document.getElementById('revealAnswer').disabled = false;
    
    updateAdminSessionStorage();
});

socket.on('timer-start', (timeLeft) => {
    updateTimerBar(timeLeft, timeLeft);
    document.getElementById('revealAnswer').disabled = false;
});

socket.on('timer-sync', (timerState) => {
    updateTimerBar(timerState.timeLeft, timerState.totalTime);
    if (timerState.timeLeft > 0) {
        document.getElementById('revealAnswer').disabled = false;
    }
});

socket.on('timer-end', () => {
    stopTimer();
    document.getElementById('revealAnswer').disabled = false;
});

socket.on('time-up', () => {
    socket.emit('reveal-answer');
});

socket.on('current-players', (players) => {
    updatePlayerList(players);
});

socket.on('player-joined', (player) => {
    // Remove any existing entries for this player name
    const existingElements = document.querySelectorAll(`li[id^="player-"]`);
    existingElements.forEach(el => {
        if (el.textContent.includes(player.name)) {
            el.remove();
        }
    });

    // Add the new player entry
    const li = document.createElement('li');
    li.id = `player-${player.id}`;
    li.innerHTML = `${player.name} <span class="player-score">${player.score || 0} poäng</span>`;
    document.getElementById('playersList').appendChild(li);
});

socket.on('player-left', (player) => {
    // Remove the specific player entry
    const li = document.getElementById(`player-${player.id}`);
    if (li) {
        li.remove();
    }
});

socket.on('scores-updated', (players) => {
    updatePlayerList(players);
});

socket.on('player-answered', (data) => {
    if (!playerAnswers.has(data.playerName)) {
        playerAnswers.set(data.playerName, data);
        updateAnswersList();
        updateAdminSessionStorage();
    }
});

socket.on('answer-revealed', (data) => {
    stopTimer();
    answerRevealed = true;
    document.getElementById('revealAnswer').disabled = true;
    document.getElementById('nextQuestion').disabled = false;
    
    updateAnswersList();
    
    if (data.isLastQuestion) {
        document.getElementById('nextQuestion').textContent = 'Avsluta spelet';
    }
    
    updateAdminSessionStorage();
});

socket.on('game-over', (players) => {
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    document.getElementById('questionDetails').innerHTML = `
        <h2>Slutresultat</h2>
        ${sortedPlayers.map((p, i) => `
            <div>${i + 1}. ${p.name}${p.connected === false ? ' (frånkopplad)' : ''}: ${p.score} poäng</div>
        `).join('')}
    `;
    enableOnlyStartGame();
    document.getElementById('nextQuestion').textContent = 'Nästa fråga';
    
    gameStarted = false;
    updateAdminSessionStorage();
});

socket.on('last-question-reached', () => {
    document.getElementById('nextQuestion').textContent = 'Avsluta spelet';
    document.getElementById('nextQuestion').disabled = false;
});

socket.on('restart-initiated', () => {
    alert('Servern startas om...');
    localStorage.removeItem('adminSession');
    window.location.reload();
});

socket.on('shutdown-initiated', () => {
    alert('Servern stängs av...');
    localStorage.removeItem('adminSession');
    window.location.href = '/index.html';
});

socket.on('disconnect', () => {
    document.getElementById('adminPanel').innerHTML = `
        <div style="text-align: center; margin-top: 20px;">
            <h3>Tappade anslutningen</h3>
            <p>Försöker återansluta...</p>
        </div>
    `;
    
    updateAdminSessionStorage();
    
    setTimeout(() => {
        window.location.reload();
    }, 2000);
});
