const socket = io();
let hasAnswered = false;
let totalScore = 0;
let playerName = '';
let sessionId = '';
let currentQuestionIndex = -1;
let submittedAnswer = null;
let otherPlayersCount = 0;

const POINTS_PER_LEVEL = [10, 8, 6, 4];
const STARS_PER_LEVEL = ['★★★★', '★★★', '★★', '★'];

// Check for existing session
window.onload = function() {
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        socket.emit('reconnect-player', sessionData);
    }
};

function updateLevelIndicator(level) {
    const pointsIndicator = document.getElementById('pointsIndicator');
    const starsContainer = document.getElementById('starsContainer');
    pointsIndicator.textContent = POINTS_PER_LEVEL[level];
    starsContainer.textContent = STARS_PER_LEVEL[level];
}

function updateOtherPlayersCount() {
    const countElement = document.getElementById('otherPlayersCount');
    if (otherPlayersCount === 0) {
        countElement.textContent = 'Inga andra spelare har anslutit än';
    } else if (otherPlayersCount === 1) {
        countElement.textContent = '1 annan spelare har anslutit';
    } else {
        countElement.textContent = `${otherPlayersCount} andra spelare har anslutit`;
    }
}

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
    document.getElementById('results').style.display = 'none';
}

function showWelcomeScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('results').style.display = 'none';
}

function showGameScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('results').style.display = 'none';
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
    document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    
    if (data.gameInProgress) {
        showGameScreen();
    } else {
        showWelcomeScreen();
    }
});

socket.on('players-updated', (count) => {
    otherPlayersCount = Math.max(0, count - 1); // Subtract 1 to exclude current player
    updateOtherPlayersCount();
});

socket.on('game-state', (state) => {
    currentQuestionIndex = state.currentQuestionIndex;
    totalScore = state.score;
    hasAnswered = state.hasAnswered;
    submittedAnswer = state.answer;

    document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    showGameScreen();
    
    updateLevelIndicator(state.currentLevel);
    document.getElementById('questionImage').src = state.image;
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
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
    updateLevelIndicator(0); // Start at level 1 (index 0)
    document.getElementById('questionImage').src = data.image;
    document.getElementById('questionText').textContent = data.questionText;
    document.getElementById('results').innerHTML = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    updateChoicesDisplay(data.choices, hasAnswered, submittedAnswer);
});

socket.on('show-level', (data) => {
    updateLevelIndicator(data.level);
    document.getElementById('questionImage').src = data.image;
});

socket.on('answer-revealed', (data) => {
    // Disable all choice buttons
    document.querySelectorAll('.choice-button').forEach(btn => {
        btn.disabled = true;
    });

    const results = document.getElementById('results');
    let resultContent = `<h3>Rätt svar: ${data.correctAnswer}</h3>`;
    
    const playerResult = data.results.find(result => result.playerName === playerName);
    
    if (!playerResult) {
        resultContent += `<p>Du gav inget svar</p>`;
    } else {
        resultContent += `
            <p>Du svarade ${playerResult.correct ? 'rätt' : 'fel'}!<br>
            Ditt svar: ${playerResult.answer}<br>
            Svarade på nivå: ${playerResult.answeredAtLevel}<br>
            Poäng: ${playerResult.points}</p>`;
        totalScore = playerResult.totalScore;
        document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    }
    
    results.innerHTML = resultContent;
    results.style.display = 'block';
});

socket.on('game-over', (players) => {
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    const results = document.getElementById('results');
    results.innerHTML = `
        <h2>Spelet är slut - Slutresultat</h2>
        ${sortedPlayers.map((p, i) => `
            <div${p.name === playerName ? ' style="font-weight: bold;"' : ''}>
                ${i + 1}. ${p.name}: ${p.score} poäng
            </div>
        `).join('')}
    `;
    results.style.display = 'block';
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
