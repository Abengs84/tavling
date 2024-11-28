const socket = io();
let gameStarted = false;
let answerRevealed = false;
let correctAnswer = null;
const playerAnswers = new Map();

// Handle login form submission
document.getElementById('loginButton').addEventListener('click', () => {
    const password = document.getElementById('password').value;
    socket.emit('admin-login', password);
});

// Handle login response
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
    }
});

socket.on('admin-connected', () => {
    console.log('Connected as admin');
    enableOnlyStartGame();
});

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
    
    // Reset the timer bar
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    
    // Force a reflow
    timerBar.offsetHeight;
    
    // Start the countdown animation
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

socket.on('timer-start', (timeLeft) => {
    updateTimerBar(timeLeft, timeLeft);
    // Enable reveal answer button as soon as the timer starts
    document.getElementById('revealAnswer').disabled = false;
});

socket.on('timer-sync', (timerState) => {
    updateTimerBar(timerState.timeLeft, timerState.totalTime);
    // Enable reveal answer button if timer is running
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

socket.on('new-question', (data) => {
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    // Store correct answer for underlining
    correctAnswer = data.correctAnswer;
    
    document.getElementById('questionDetails').innerHTML = `
        <div class="question-text">${data.questionText}</div>
        <div class="alternatives">Alternativ: ${data.choices.map(choice => 
            choice === correctAnswer ? `<u>${choice}</u>` : choice
        ).join(', ')}</div>
    `;
    document.getElementById('answersList').innerHTML = '';
    playerAnswers.clear();
    answerRevealed = false;
    
    document.getElementById('startGame').disabled = true;
    document.getElementById('nextQuestion').disabled = true;
    // Don't disable reveal answer button, allow admin to reveal at any time
    document.getElementById('revealAnswer').disabled = false;
});

function updatePlayerList(players) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.id = `player-${player.id}`;
        li.innerHTML = `${player.name} <span class="player-score">${player.score} poäng</span>`;
        playersList.appendChild(li);
    });
}

socket.on('current-players', (players) => {
    updatePlayerList(players);
});

socket.on('player-joined', (player) => {
    const existingLi = document.getElementById(`player-${player.id}`);
    if (!existingLi) {
        const li = document.createElement('li');
        li.id = `player-${player.id}`;
        li.innerHTML = `${player.name} <span class="player-score">${player.score || 0} poäng</span>`;
        document.getElementById('playersList').appendChild(li);
    }
});

socket.on('player-left', (player) => {
    const li = document.getElementById(`player-${player.id}`);
    if (li) li.remove();
});

socket.on('scores-updated', (players) => {
    updatePlayerList(players);
});

socket.on('player-answered', (data) => {
    if (!playerAnswers.has(data.playerName)) {
        playerAnswers.set(data.playerName, data);
        updateAnswersList();
    }
});

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

socket.on('answer-revealed', (data) => {
    stopTimer();
    answerRevealed = true;
    document.getElementById('revealAnswer').disabled = true;
    document.getElementById('nextQuestion').disabled = false;
    
    // Update the answers list with correct/incorrect indicators
    updateAnswersList();
    
    if (data.isLastQuestion) {
        document.getElementById('nextQuestion').textContent = 'Avsluta spelet';
    }
});

socket.on('game-over', (players) => {
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    document.getElementById('questionDetails').innerHTML = `
        <h2>Slutresultat</h2>
        ${sortedPlayers.map((p, i) => `
            <div>${i + 1}. ${p.name}: ${p.score} poäng</div>
        `).join('')}
    `;
    enableOnlyStartGame();
    document.getElementById('nextQuestion').textContent = 'Nästa fråga';
});

document.getElementById('startGame').addEventListener('click', () => {
    socket.emit('start-game');
    gameStarted = true;
});

document.getElementById('revealAnswer').addEventListener('click', () => {
    stopTimer();
    socket.emit('reveal-answer');
});

document.getElementById('nextQuestion').addEventListener('click', () => {
    if (document.getElementById('nextQuestion').textContent === 'Avsluta spelet') {
        socket.emit('next-question');
        document.getElementById('nextQuestion').disabled = true;
        document.getElementById('nextQuestion').textContent = 'Nästa fråga';
    } else {
        socket.emit('next-question');
        document.getElementById('nextQuestion').disabled = true;
    }
});

// Handle Enter key in password input
document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('loginButton').click();
    }
});
