const socket = io();
let hasAnswered = false;
let totalScore = 0;
let playerName = '';
let sessionId = '';
let currentQuestionIndex = -1;
let submittedAnswer = null;

// Check for existing session
window.onload = function() {
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        socket.emit('reconnect-player', sessionData);
    }
};

function updateChoicesDisplay(choices, hasAnswered, submittedAnswer) {
    const choicesContainer = document.getElementById('choices');
    choicesContainer.innerHTML = '';
    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.textContent = choice;
        
        if (hasAnswered) {
            button.disabled = true;
            if (choice === submittedAnswer) {
                button.style.background = '#6c757d';
            }
        } else {
            button.onclick = () => submitAnswer(choice);
        }
        choicesContainer.appendChild(button);
    });
}

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

socket.on('connection-error', function(error) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = error;
    errorMessage.style.display = 'block';
    showLoginScreen();
});

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

function showWelcomeScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
}

function showGameScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
}

function joinGame() {
    const nameInput = document.getElementById('playerName').value.trim();
    if (nameInput) {
        socket.emit('player-connect', { name: nameInput });
    }
}

socket.on('player-welcome', (data) => {
    playerName = data.name;
    sessionId = data.sessionId;
    totalScore = data.score || 0;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.submittedAnswer || null;
    
    // Save session data
    localStorage.setItem('quizSession', JSON.stringify({
        name: playerName,
        sessionId: sessionId,
        score: totalScore
    }));

    document.getElementById('welcomePlayerName').textContent = playerName;
    document.getElementById('score').textContent = `Score: ${totalScore}`;
    
    if (data.gameInProgress) {
        showGameScreen();
    } else {
        showWelcomeScreen();
    }
});

socket.on('game-state', (state) => {
    currentQuestionIndex = state.currentQuestionIndex;
    totalScore = state.score;
    hasAnswered = state.hasAnswered;
    submittedAnswer = state.answer;

    document.getElementById('score').textContent = `Score: ${totalScore}`;
    showGameScreen();
    
    document.getElementById('currentLevel').textContent = state.currentLevel + 1;
    document.getElementById('questionImage').src = state.image;
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Question ${state.questionNumber} of ${state.totalQuestions}`;
    
    updateChoicesDisplay(state.choices, hasAnswered, submittedAnswer);
});

socket.on('answer-error', (error) => {
    hasAnswered = true;
    document.querySelectorAll('.choice-button').forEach(btn => {
        btn.disabled = true;
    });
});

socket.on('answer-confirmed', (data) => {
    hasAnswered = true;
    submittedAnswer = data.answer;
    document.querySelectorAll('.choice-button').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === data.answer) {
            btn.style.background = '#6c757d';
        }
    });
});

function submitAnswer(choice) {
    if (!hasAnswered) {
        socket.emit('submit-answer', choice);
    }
}

socket.on('new-question', (data) => {
    currentQuestionIndex = data.questionNumber - 1;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.answer || null;
    
    showGameScreen();
    document.getElementById('currentLevel').textContent = '1';
    document.getElementById('questionImage').src = data.image;
    document.getElementById('questionText').textContent = data.questionText;
    document.getElementById('results').innerHTML = '';
    document.getElementById('gameProgress').textContent = 
        `Question ${data.questionNumber} of ${data.totalQuestions}`;
    
    updateChoicesDisplay(data.choices, hasAnswered, submittedAnswer);
});

socket.on('show-level', (data) => {
    document.getElementById('currentLevel').textContent = (data.level + 1).toString();
    document.getElementById('questionImage').src = data.image;
});

socket.on('answer-revealed', (data) => {
    const results = document.getElementById('results');
    results.innerHTML = `<h3>Correct Answer: ${data.correctAnswer}</h3>`;
    
    data.results.forEach(result => {
        if (result.playerName === playerName) {
            totalScore = result.totalScore;
            document.getElementById('score').textContent = `Score: ${totalScore}`;
            results.innerHTML += `
                <p>You ${result.correct ? 'got it right' : 'got it wrong'}!<br>
                Your answer: ${result.answer}<br>
                Answered at Level: ${result.answeredAtLevel}<br>
                Points earned: ${result.points}</p>`;
        }
    });
});

socket.on('game-over', (players) => {
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    const results = document.getElementById('results');
    results.innerHTML = `
        <h2>Game Over - Final Scores</h2>
        ${sortedPlayers.map((p, i) => `
            <div${p.name === playerName ? ' style="font-weight: bold;"' : ''}>
                ${i + 1}. ${p.name}: ${p.score} points
            </div>
        `).join('')}
    `;
    localStorage.removeItem('quizSession');
    setTimeout(() => {
        showLoginScreen();
    }, 10000);
});

socket.on('disconnect', () => {
    showLoginScreen();
});

// Handle Enter key in name input
document.getElementById('playerName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        joinGame();
    }
});
