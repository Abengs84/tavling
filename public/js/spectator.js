const socket = io();
let currentChoices = [];
let allPlayers = new Map(); // Keep track of all players and their scores
let timerBar = null;

function updateChoicesDisplay(choices, correctAnswer = null) {
    const choicesContainer = document.getElementById('choices');
    choicesContainer.innerHTML = '';
    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        if (correctAnswer) {
            if (choice === correctAnswer) {
                button.className += ' correct';
            } else {
                button.className += ' incorrect';
            }
        }
        button.textContent = choice;
        choicesContainer.appendChild(button);
    });
}

function updateTimerBar(timeLeft, totalTime) {
    const timerBar = document.getElementById('timerBar');
    const timerContainer = document.getElementById('timer-container');
    
    // Show the timer container and bar
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

function displayLeaderboard(results) {
    // Update scores for players who answered
    results.forEach(result => {
        allPlayers.set(result.playerName, result.totalScore);
    });

    // Convert Map to array and sort by score
    const sortedPlayers = Array.from(allPlayers.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // Only take top 3

    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = `
        <h2>Topplista</h2>
        ${sortedPlayers.map((player, index) => `
            <div class="leaderboard-entry rank-${index + 1}">
                <div class="leaderboard-position">${index + 1}</div>
                <div class="leaderboard-name">${player.name}</div>
                <div class="leaderboard-score">${player.score} poäng</div>
            </div>
        `).join('')}
    `;
}

socket.on('game-state', (state) => {
    document.getElementById('questionText').textContent = state.questionText;
    document.getElementById('gameProgress').textContent = 
        `Fråga ${state.questionNumber} av ${state.totalQuestions}`;
    
    currentChoices = state.choices;
    updateChoicesDisplay(state.choices);
    document.getElementById('results').style.display = 'none';
    document.getElementById('choices').style.display = 'grid';

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
});

socket.on('answer-revealed', (data) => {
    // Stop the timer animation
    stopTimer();
    
    // Hide the choices container
    document.getElementById('choices').style.display = 'none';
    
    // Show correct answer
    const correctAnswerDiv = document.getElementById('correctAnswer');
    correctAnswerDiv.innerHTML = `<h2>Rätt svar: ${data.correctAnswer}</h2>`;
    
    // Display leaderboard with all players
    displayLeaderboard(data.results);
    
    // Show results
    document.getElementById('results').style.display = 'block';
});

socket.on('game-over', (data) => {
    document.getElementById('questionText').textContent = 'Quiz Avslutat';
    document.getElementById('choices').style.display = 'none';
    document.getElementById('gameProgress').style.display = 'none';
    document.getElementById('correctAnswer').innerHTML = '<h2>Slutresultat</h2>';
    
    // Convert players array to the format displayLeaderboard expects
    const results = data.map(player => ({
        playerName: player.name,
        totalScore: player.score
    }));
    displayLeaderboard(results);
    document.getElementById('results').style.display = 'block';
});

// Handle player joined/left events to track all players
socket.on('player-joined', (data) => {
    allPlayers.set(data.name, data.score);
});

socket.on('player-left', (data) => {
    allPlayers.delete(data.name);
});

// Connect as spectator
socket.emit('spectator-join');
