const socket = io();
let hasAnswered = false;
let totalScore = 0;
let playerName = '';
let sessionId = '';
let currentQuestionIndex = -1;
let submittedAnswer = null;

const TOP_PLAYERS_TO_SHOW = 5;

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

socket.on('player-welcome', (data) => {
    playerName = data.name;
    sessionId = data.sessionId;
    totalScore = data.score || 0;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.submittedAnswer || null;
    
    document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    document.getElementById('gameScreen').style.display = 'block';
});

socket.on('game-state', (state) => {
    currentQuestionIndex = state.currentQuestionIndex;
    totalScore = state.score;
    hasAnswered = state.hasAnswered;
    submittedAnswer = state.answer;

    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('score').textContent = `Poäng: ${totalScore}`;
    
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
    updateChoicesDisplay(state.choices, hasAnswered, submittedAnswer);

    // Handle timer state if provided
    if (state.timerState) {
        updateTimerBar(state.timerState.timeLeft, state.timerState.totalTime);
    }
});

socket.on('timer-start', (timeLeft) => {
    updateTimerBar(timeLeft, timeLeft);
});

socket.on('timer-sync', (timerState) => {
    updateTimerBar(timerState.timeLeft, timerState.totalTime);
});

socket.on('timer-end', () => {
    stopTimer();
    if (!hasAnswered) {
        document.querySelectorAll('.choice-button').forEach(btn => {
            btn.disabled = true;
        });
    }
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
    currentQuestionIndex = data.questionNumber - 1;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.answer || null;
    
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('questionText').textContent = data.questionText;
    document.getElementById('results').innerHTML = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    updateChoicesDisplay(data.choices, hasAnswered, submittedAnswer);
});

socket.on('answer-revealed', (data) => {
    // Stop the timer animation
    stopTimer();

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
        resultContent += `<p>Du svarade ${playerResult.correct ? 'rätt' : 'fel'}!`;
        
        if (!playerResult.correct) {
            resultContent += `<br>Ditt svar: ${playerResult.answer}`;
        }
        
        resultContent += `<br>Poäng: ${playerResult.points}</p>`;
        
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
    document.getElementById('choices').style.display = 'none';
    document.getElementById('gameProgress').style.display = 'none';
    
    // Create a new container for final scores
    const gameScreen = document.getElementById('gameScreen');
    const finalScoresDiv = document.createElement('div');
    finalScoresDiv.className = 'final-scores';
    finalScoresDiv.innerHTML = `
        <h2>Slutresultat</h2>
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
