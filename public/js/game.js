const socket = io();
let hasAnswered = false;
let totalScore = 0;
let playerName = '';
let sessionId = '';
let currentQuestionIndex = -1;
let submittedAnswer = null;
let gameInProgress = false;

const TOP_PLAYERS_TO_SHOW = 5;

// Check for existing session and reconnect
window.onload = function() {
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            if (sessionData.name && sessionData.sessionId) {
                playerName = sessionData.name;
                sessionId = sessionData.sessionId;
                totalScore = sessionData.score || 0;
                currentQuestionIndex = sessionData.currentQuestionIndex;
                gameInProgress = sessionData.gameInProgress;
                
                document.getElementById('gameScreen').style.display = 'block';
                socket.emit('reconnect-player', sessionData);
            } else {
                window.location.href = '/index.html';
            }
        } catch (e) {
            window.location.href = '/index.html';
        }
    } else {
        window.location.href = '/index.html';
    }
};

function createYearInput(hasAnswered, submittedAnswer) {
    const container = document.createElement('div');
    container.style.cssText = `
        max-width: 400px;
        margin: 20px auto;
        padding: 20px;
        background-color: rgba(33, 150, 243, 0.1);
        border: 2px solid #2196F3;
        border-radius: 8px;
        text-align: center;
    `;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'yearInput';
    input.placeholder = 'Ange ett årtal';
    input.min = '1000';
    input.max = '2024';
    input.disabled = hasAnswered;
    input.value = hasAnswered && submittedAnswer ? submittedAnswer : '';
    input.style.cssText = `
        width: 200px;
        text-align: center;
        font-size: 1.2em;
        padding: 12px;
        margin: 10px auto;
        border: 2px solid #2196F3;
        border-radius: 8px;
        background-color: ${hasAnswered ? '#1e1e1e' : '#ffffff'};
        color: ${hasAnswered ? '#666' : '#000000'};
        display: block;
        pointer-events: ${hasAnswered ? 'none' : 'auto'};
    `;
    
    const button = document.createElement('button');
    button.textContent = hasAnswered ? 'Svar låst' : 'Svara';
    button.disabled = hasAnswered;
    button.style.cssText = `
        display: block;
        width: 200px;
        margin: 10px auto;
        padding: 12px;
        border: none;
        border-radius: 24px;
        background: ${hasAnswered ? '#1e1e1e' : '#2196F3'};
        color: ${hasAnswered ? '#666' : 'white'};
        cursor: ${hasAnswered ? 'not-allowed' : 'pointer'};
        font-size: 1em;
        pointer-events: ${hasAnswered ? 'none' : 'auto'};
    `;
    
    if (!hasAnswered) {
        button.onclick = () => {
            const year = input.value;
            if (year && year.length === 4 && !isNaN(year)) {
                // Disable input and button immediately
                input.disabled = true;
                button.disabled = true;
                input.style.backgroundColor = '#1e1e1e';
                input.style.color = '#666';
                input.style.pointerEvents = 'none';
                button.style.backgroundColor = '#1e1e1e';
                button.style.color = '#666';
                button.style.pointerEvents = 'none';
                button.textContent = 'Svar låst';
                
                submitAnswer(year);
            } else {
                alert('Vänligen ange ett giltigt årtal med 4 siffror');
            }
        };
        
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                button.click();
            }
        });
    }
    
    container.appendChild(input);
    container.appendChild(button);
    
    if (hasAnswered) {
        const lockedMessage = document.createElement('div');
        lockedMessage.textContent = 'Ditt svar är låst';
        lockedMessage.style.cssText = `
            color: #666;
            font-style: italic;
            margin-top: 10px;
        `;
        container.appendChild(lockedMessage);
    }
    
    return container;
}

function updateChoicesDisplay(choices, hasAnswered, submittedAnswer, questionType) {
    const choicesContainer = document.getElementById('choices');
    choicesContainer.innerHTML = '';
    
    if (questionType === 'year') {
        const yearInput = createYearInput(hasAnswered, submittedAnswer);
        choicesContainer.appendChild(yearInput);
    } else {
        choices.forEach(choice => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            if (hasAnswered && choice === submittedAnswer) {
                button.classList.add('selected');
            }
            button.textContent = choice;
            button.disabled = hasAnswered;
            
            if (!hasAnswered) {
                button.onclick = () => {
                    // Remove selected class from all buttons
                    choicesContainer.querySelectorAll('.choice-button').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    // Add selected class to clicked button
                    button.classList.add('selected');
                    submitAnswer(choice);
                };
            }
            choicesContainer.appendChild(button);
        });
    }
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

function updateSessionStorage() {
    const sessionData = {
        name: playerName,
        sessionId: sessionId,
        score: totalScore,
        currentQuestionIndex: currentQuestionIndex,
        gameInProgress: gameInProgress,
        hasAnswered: hasAnswered,
        submittedAnswer: submittedAnswer
    };
    localStorage.setItem('quizSession', JSON.stringify(sessionData));
}

function submitAnswer(choice) {
    if (!hasAnswered) {
        socket.emit('submit-answer', choice);
    }
}

socket.on('player-welcome', (data) => {
    playerName = data.name;
    sessionId = data.sessionId;
    totalScore = data.score || 0;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.submittedAnswer || null;
    gameInProgress = data.gameInProgress;
    currentQuestionIndex = data.currentQuestionIndex;
    
    updateSessionStorage();
    document.getElementById('gameScreen').style.display = 'block';
});

socket.on('game-state', (state) => {
    // Handle game-over state
    if (state.gameOver && state.finalResults) {
        showFinalResults(state.finalResults);
        return;
    }

    currentQuestionIndex = state.currentQuestionIndex;
    totalScore = state.score;
    hasAnswered = state.hasAnswered;
    submittedAnswer = state.answer;
    gameInProgress = true;

    document.getElementById('gameScreen').style.display = 'block';
    
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
    updateChoicesDisplay(state.choices, hasAnswered, submittedAnswer, state.questionType);
    updateSessionStorage();

    if (state.timerState) {
        updateTimerBar(state.timerState.timeLeft, state.timerState.totalTime);
    }
});

socket.on('new-question', (data) => {
    currentQuestionIndex = data.questionNumber - 1;
    hasAnswered = false;
    submittedAnswer = null;
    
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('questionText').textContent = data.questionText;
    document.getElementById('results').innerHTML = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    updateChoicesDisplay(data.choices, hasAnswered, submittedAnswer, data.questionType);
    updateSessionStorage();
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
        document.querySelectorAll('.choice-button, #yearInput, button').forEach(btn => {
            btn.disabled = true;
        });
    }
    
    const results = document.getElementById('results');
    results.innerHTML = `
        <div style="text-align: center; margin-top: 20px;">
            <h3>Tiden är ute</h3>
            <p>${hasAnswered ? 'Tack för ditt svar' : 'Du gav inget svar'}</p>
        </div>
    `;
    results.style.display = 'block';
});

socket.on('answer-confirmed', (data) => {
    hasAnswered = true;
    submittedAnswer = data.answer;
    document.querySelectorAll('.choice-button, #yearInput, button').forEach(btn => {
        btn.disabled = true;
    });
    const yearInput = document.getElementById('yearInput');
    if (yearInput) {
        yearInput.value = data.answer;
    }
    updateSessionStorage();
});

socket.on('answer-revealed', (data) => {
    stopTimer();
    document.querySelectorAll('.choice-button, #yearInput, button').forEach(btn => {
        btn.disabled = true;
    });
    
    const playerResult = data.results.find(result => result.playerName === playerName);
    if (playerResult) {
        totalScore = playerResult.totalScore;
        updateSessionStorage();
    }
});

socket.on('game-over', (players) => {
    showFinalResults(players);
});

function showFinalResults(players) {
    gameInProgress = false;
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    const currentPlayerIndex = sortedPlayers.findIndex(p => p.name === playerName);
    
    let playersToShow = sortedPlayers.slice(0, TOP_PLAYERS_TO_SHOW);
    if (currentPlayerIndex >= TOP_PLAYERS_TO_SHOW) {
        playersToShow.push({
            ...sortedPlayers[currentPlayerIndex],
            showDivider: true
        });
    }
    
    document.getElementById('choices').style.display = 'none';
    document.getElementById('gameProgress').style.display = 'none';
    
    let medalHtml = '';
    if (currentPlayerIndex < 3) {
        const medalImg = new Image();
        medalImg.src = `/img/${currentPlayerIndex + 1}.png`;
        medalHtml = `<div style="text-align: center;"><img src="/img/${currentPlayerIndex + 1}.png" alt="Medal" style="width: 150px; height: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;"></div>`;
        
        document.body.classList.remove('gold-winner', 'silver-winner', 'bronze-winner');
        if (currentPlayerIndex === 0) {
            document.body.classList.add('gold-winner');
        } else if (currentPlayerIndex === 1) {
            document.body.classList.add('silver-winner');
        } else if (currentPlayerIndex === 2) {
            document.body.classList.add('bronze-winner');
        }
    }
    
    const gameScreen = document.getElementById('gameScreen');
    const finalScoresDiv = document.createElement('div');
    finalScoresDiv.className = 'final-scores';
    finalScoresDiv.innerHTML = `
        ${medalHtml}
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
    
    gameScreen.innerHTML = '';
    gameScreen.appendChild(finalScoresDiv);
    
    // Update session storage with game-over state
    const sessionData = {
        name: playerName,
        sessionId: sessionId,
        score: totalScore,
        gameOver: true,
        finalResults: players
    };
    localStorage.setItem('quizSession', JSON.stringify(sessionData));
}

socket.on('disconnect', () => {
    // Only reload if game is still in progress
    if (gameInProgress) {
        document.getElementById('gameScreen').innerHTML = `
            <div style="text-align: center; margin-top: 20px;">
                <h3>Tappade anslutningen</h3>
                <p>Försöker återansluta...</p>
            </div>
        `;
        
        // Attempt to reconnect
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
});
