// Make submitYear function global
window.submitYear = function() {
    const yearInput = document.getElementById('yearInput');
    const year = yearInput.value;
    if (year && year.length === 4 && !isNaN(year)) {
        submitAnswer(year);
    } else {
        alert('Vänligen ange ett giltigt årtal med 4 siffror');
    }
};

// Initialize socket
const socket = io();

let hasAnswered = false;
let totalScore = 0;
let playerName = '';
let sessionId = '';
let currentQuestionIndex = -1;
let submittedAnswer = null;
let otherPlayersCount = 0;

// Check for existing session
window.onload = function() {
    const savedSession = localStorage.getItem('quizSession');
    if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        socket.emit('reconnect-player', sessionData);
    }
};

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

function createYearInput(hasAnswered, submittedAnswer) {
    const container = document.createElement('div');
    container.style.cssText = `
        width: 90%;
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
        
        // Add enter key support
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

function createMultipleChoice(choices, hasAnswered, submittedAnswer) {
    const container = document.createElement('div');
    container.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        width: 90%;
        max-width: 400px;
        margin: 20px auto;
        padding: 20px;
    `;
    
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
                container.querySelectorAll('.choice-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
                // Add selected class to clicked button
                button.classList.add('selected');
                submitAnswer(choice);
            };
        }
        container.appendChild(button);
    });
    
    return container;
}

function updateChoicesDisplay(choices, hasAnswered, submittedAnswer, questionType) {
    const choicesContainer = document.getElementById('choices');
    if (!choicesContainer) return;
    
    choicesContainer.innerHTML = '';
    
    // Set container style based on question type
    if (questionType === 'year') {
        choicesContainer.style.cssText = `
            width: 90%;
            max-width: 400px;
            margin: 20px auto;
            padding: 20px;
        `;
    } else {
        choicesContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            width: 90%;
            max-width: 400px;
            margin: 20px auto;
            padding: 20px;
        `;
    }
    
    const content = questionType === 'year' 
        ? createYearInput(hasAnswered, submittedAnswer)
        : createMultipleChoice(choices, hasAnswered, submittedAnswer);
    
    choicesContainer.appendChild(content);
}

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

socket.on('player-welcome', (data) => {
    playerName = data.name;
    sessionId = data.sessionId;
    totalScore = data.score || 0;
    hasAnswered = data.hasAnswered || false;
    submittedAnswer = data.submittedAnswer || null;
    
    localStorage.setItem('quizSession', JSON.stringify({
        name: playerName,
        sessionId: sessionId,
        score: totalScore
    }));

    document.getElementById('welcomePlayerName').textContent = playerName;
    
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.style.display = 'none';
    }
    
    if (data.gameInProgress) {
        showGameScreen();
    } else {
        showWelcomeScreen();
    }
});

socket.on('players-updated', (count) => {
    otherPlayersCount = Math.max(0, count - 1);
    updateOtherPlayersCount();
});

socket.on('game-state', (state) => {
    currentQuestionIndex = state.currentQuestionIndex;
    totalScore = state.score;
    hasAnswered = state.hasAnswered;
    submittedAnswer = state.answer;

    showGameScreen();
    
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
    updateChoicesDisplay(state.choices, hasAnswered, submittedAnswer, state.questionType);
});

socket.on('answer-error', (error) => {
    hasAnswered = true;
    document.querySelectorAll('.choice-button, #yearInput, button').forEach(el => {
        el.disabled = true;
    });
});

socket.on('answer-confirmed', (data) => {
    hasAnswered = true;
    submittedAnswer = data.answer;
    document.querySelectorAll('.choice-button, #yearInput, button').forEach(el => {
        el.disabled = true;
    });
    const yearInput = document.getElementById('yearInput');
    if (yearInput) {
        yearInput.value = data.answer;
    }
});

function submitAnswer(choice) {
    if (!hasAnswered) {
        socket.emit('submit-answer', choice);
    }
}

socket.on('new-question', (data) => {
    // Reset all state for new question
    currentQuestionIndex = data.questionNumber - 1;
    hasAnswered = false; // Reset answer state
    submittedAnswer = null; // Clear previous answer
    
    showGameScreen();
    document.getElementById('questionText').textContent = data.questionText;
    document.getElementById('results').innerHTML = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    updateChoicesDisplay(data.choices, hasAnswered, submittedAnswer, data.questionType);
});

socket.on('timer-end', () => {
    const results = document.getElementById('results');
    results.innerHTML = `
        <div style="text-align: center; margin-top: 20px;">
            <h3>Tiden är ute</h3>
            <p>Tack för ditt svar</p>
        </div>
    `;
    results.style.display = 'block';
});

socket.on('answer-revealed', (data) => {
    document.querySelectorAll('.choice-button, #yearInput, button').forEach(el => {
        el.disabled = true;
    });
    
    const playerResult = data.results.find(result => result.playerName === playerName);
    if (playerResult) {
        totalScore = playerResult.totalScore;
    }
});

socket.on('game-over', (players) => {
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    const results = document.getElementById('results');
    results.innerHTML = `
        <h2>Slutresultat</h2>
        ${sortedPlayers.map((p, i) => `
            <div${p.name === playerName ? ' style="font-weight: bold;"' : ''}>
                ${i + 1}
                ${p.name}
                ${p.score} poäng
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
