const socket = io();
let currentChoices = [];
let allPlayers = new Map(); // Keep track of all players and their scores
let timerBar = null;

const TOP_PLAYERS_TO_SHOW = 10; // Show top 10 players in leaderboard

function updateChoicesDisplay(choices) {
    const choicesContainer = document.getElementById('choices');
    choicesContainer.innerHTML = '';
    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.textContent = choice;
        choicesContainer.appendChild(button);
    });
}

function updateTimerBar(timeLeft, totalTime) {
    const timerBar = document.getElementById('timerBar');
    const timerContainer = document.getElementById('timer-container');
    
    timerContainer.style.display = 'block';
    timerBar.style.display = 'block';
    
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

function displayLeaderboard(players) {
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = `
        <h2>Slutresultat</h2>
        ${players.slice(0, TOP_PLAYERS_TO_SHOW).map((player, index) => `
            <div class="leaderboard-entry rank-${index + 1}">
                <div class="leaderboard-position">${index + 1}</div>
                <div class="leaderboard-name">
                    ${player.name}${player.connected === false ? ' (frånkopplad)' : ''}
                </div>
                <div class="leaderboard-score">${player.score} poäng</div>
            </div>
        `).join('')}
    `;
    leaderboard.style.display = 'block';
}

socket.on('game-state', (state) => {
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
    currentChoices = state.choices;
    updateChoicesDisplay(state.choices);
    document.getElementById('results').style.display = 'none';
    document.getElementById('choices').style.display = 'grid';
    document.getElementById('leaderboard').style.display = 'none';

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
});

socket.on('new-question', (data) => {
    document.getElementById('questionText').textContent = data.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    
    // Hide timer container when new question appears
    document.getElementById('timer-container').style.display = 'none';
    
    currentChoices = data.choices;
    updateChoicesDisplay(data.choices);
    document.getElementById('results').style.display = 'none';
    document.getElementById('choices').style.display = 'grid';
    document.getElementById('leaderboard').style.display = 'none';
});

socket.on('answer-revealed', (data) => {
    stopTimer();
    
    // Update scores based on results
    data.results.forEach(result => {
        allPlayers.set(result.playerName, result.totalScore);
    });
});

socket.on('game-over', (players) => {
    document.getElementById('questionText').textContent = 'Quiz Avslutat';
    document.getElementById('choices').style.display = 'none';
    document.getElementById('gameProgress').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    document.getElementById('timer-container').style.display = 'none';
    
    displayLeaderboard(players);
});

// Connect as spectator
socket.emit('spectator-join');
