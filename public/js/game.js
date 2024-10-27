const socket = io();
let hasAnswered = false;
let totalScore = 0;
let playerName = '';
let sessionId = '';
let currentQuestionIndex = -1;
let submittedAnswer = null;

const POINTS_PER_LEVEL = [10, 8, 6, 4];
const STARS_PER_LEVEL = ['★★★★', '★★★', '★★', '★'];
const TOP_PLAYERS_TO_SHOW = 10;

// Check for existing session and reconnect
window.onload = function() {
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        playerName = sessionData.name; // Set playerName immediately
        document.getElementById('gameScreen').style.display = 'block'; // Ensure game screen is visible
        socket.emit('reconnect-player', sessionData);
    } else {
        // If no session exists, redirect to login
        window.location.href = '/index.html';
    }
};

function updateLevelIndicator(level) {
    const pointsIndicator = document.getElementById('pointsIndicator');
    const starsContainer = document.getElementById('starsContainer');
    pointsIndicator.textContent = POINTS_PER_LEVEL[level];
    starsContainer.textContent = STARS_PER_LEVEL[level];
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

socket.on('player-welcome', (data) => {
    playerName = data.name;
    sessionId = data.sessionId;
    totalScore = data.score || 0;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.submittedAnswer || null;
    
    document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    document.getElementById('gameScreen').style.display = 'block'; // Ensure game screen is visible
});

socket.on('game-state', (state) => {
    console.log('Received game state:', state); // Debug log
    currentQuestionIndex = state.currentQuestionIndex;
    totalScore = state.score;
    hasAnswered = state.hasAnswered;
    submittedAnswer = state.answer;

    document.getElementById('gameScreen').style.display = 'block'; // Ensure game screen is visible
    document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    
    updateLevelIndicator(state.currentLevel);
    document.getElementById('questionImage').src = state.image;
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
    updateChoicesDisplay(state.choices, hasAnswered, submittedAnswer);
});

socket.on('connection-error', function(error) {
    // Redirect to login page with error
    localStorage.removeItem('quizSession');
    window.location.href = `/index.html?error=${encodeURIComponent(error)}`;
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
    console.log('Received new question:', data); // Debug log
    currentQuestionIndex = data.questionNumber - 1;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.answer || null;
    
    document.getElementById('gameScreen').style.display = 'block'; // Ensure game screen is visible
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
    
    // Find current player's position
    const currentPlayerIndex = sortedPlayers.findIndex(p => p.name === playerName);
    
    // Get top players and current player if not in top
    let playersToShow = sortedPlayers.slice(0, TOP_PLAYERS_TO_SHOW);
    if (currentPlayerIndex >= TOP_PLAYERS_TO_SHOW) {
        playersToShow.push({
            ...sortedPlayers[currentPlayerIndex],
            showDivider: true // Add flag to show divider
        });
    }
    
    // Hide game elements
    document.getElementById('questionImage').style.display = 'none';
    document.getElementById('choices').style.display = 'none';
    document.getElementById('gameProgress').style.display = 'none';
    document.querySelector('.level-indicator').style.display = 'none';
    
    // Create a new container for final scores
    const gameScreen = document.getElementById('gameScreen');
    const finalScoresDiv = document.createElement('div');
    finalScoresDiv.className = 'final-scores';
    finalScoresDiv.innerHTML = `
        <h2>Spelet är slut<br>Slutresultat</h2>
        <div class="scores-list">
            ${playersToShow.map((p, i) => `
                ${p.showDivider ? '<div class="score-divider"></div>' : ''}
                <div class="score-entry${p.name === playerName ? ' current-player' : ''}">
                    <div class="position">${p.showDivider ? currentPlayerIndex + 1 : i + 1}</div>
                    <div class="player-name">${p.name}</div>
                    <div class="final-score">${p.score} poäng</div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Clear and append the final scores
    gameScreen.innerHTML = '';
    gameScreen.appendChild(finalScoresDiv);
    
    // Clear session but don't redirect
    localStorage.removeItem('quizSession');
});

socket.on('disconnect', () => {
    window.location.href = '/index.html';
});
