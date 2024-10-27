const socket = io();
let currentLevel = 0;
let gameStarted = false;
let answerRevealed = false;
const playerAnswers = new Map();
let correctAnswer = null;
const connectedPlayers = new Map(); // Track connected players

socket.emit('admin-connect');

socket.on('admin-connected', () => {
    console.log('Connected as admin');
    enableOnlyStartGame();
    // Hide the image element completely
    const imageElement = document.getElementById('currentImage');
    imageElement.style.display = 'none';
    imageElement.src = '';
});

function enableOnlyStartGame() {
    document.getElementById('startGame').disabled = false;
    document.getElementById('nextLevel').disabled = true;
    document.getElementById('revealAnswer').disabled = true;
    document.getElementById('nextQuestion').disabled = true;
    document.getElementById('answersList').innerHTML = '';
    playerAnswers.clear();
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    Array.from(connectedPlayers.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(player => {
            const li = document.createElement('li');
            li.id = `player-${player.id}`;
            li.textContent = player.name;
            playersList.appendChild(li);
        });
}

socket.on('new-question', (data) => {
    document.getElementById('gameProgress').textContent = 
        `Fråga ${data.questionNumber} av ${data.totalQuestions}`;
    document.getElementById('questionDetails').innerHTML = `
        <div class="question-text">${data.questionText}</div>
        <div>Alternativ: ${data.choices.join(', ')}</div>
    `;
    const imageElement = document.getElementById('currentImage');
    imageElement.style.display = 'block';
    imageElement.src = data.image;
    document.getElementById('answersList').innerHTML = '';
    playerAnswers.clear();
    currentLevel = 0;
    answerRevealed = false;
    
    document.getElementById('startGame').disabled = true;
    document.getElementById('nextLevel').disabled = false;
    document.getElementById('revealAnswer').disabled = false;
    document.getElementById('nextQuestion').disabled = true;
});

socket.on('player-joined', (player) => {
    connectedPlayers.set(player.id, player);
    updatePlayersList();
});

socket.on('player-left', (player) => {
    connectedPlayers.delete(player.id);
    updatePlayersList();
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
    
    // Sort answers by level
    const sortedAnswers = Array.from(playerAnswers.values())
        .sort((a, b) => a.level - b.level);
    
    sortedAnswers.forEach(answer => {
        const div = document.createElement('div');
        div.className = 'player-answer';
        
        let answerStatus = '';
        if (correctAnswer !== null) {
            const isCorrect = answer.answer === correctAnswer;
            answerStatus = `<span class="answer-status ${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '✓' : '✗'}
            </span>`;
        }
        
        div.innerHTML = `
            <div class="answer-details">
                <strong>${answer.playerName}</strong>
                <span class="answer-text">svarade "${answer.answer}"</span>
                <span class="level-badge">Nivå ${answer.level + 1}</span>
                ${answerStatus}
            </div>
        `;
        answersList.appendChild(div);
    });
}

socket.on('answer-revealed', (data) => {
    answerRevealed = true;
    correctAnswer = data.correctAnswer;
    document.getElementById('nextLevel').disabled = true;
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
        <h2>Spelet är slut - Slutresultat</h2>
        ${sortedPlayers.map((p, i) => `
            <div>${i + 1}. ${p.name}: ${p.score} poäng</div>
        `).join('')}
    `;
    enableOnlyStartGame();
    document.getElementById('nextQuestion').textContent = 'Nästa fråga';
    // Hide the image element completely when game is over
    const imageElement = document.getElementById('currentImage');
    imageElement.style.display = 'none';
    imageElement.src = '';
    
    // Clear answers but keep player list
    document.getElementById('answersList').innerHTML = '';
    playerAnswers.clear();
    correctAnswer = null;
});

socket.on('current-players', (players) => {
    // Update connected players when receiving current state
    connectedPlayers.clear();
    players.forEach(player => {
        connectedPlayers.set(player.id, player);
    });
    updatePlayersList();
});

document.getElementById('startGame').addEventListener('click', () => {
    socket.emit('start-game');
    gameStarted = true;
});

document.getElementById('nextLevel').addEventListener('click', () => {
    if (currentLevel < 3 && !answerRevealed) {
        currentLevel++;
        socket.emit('next-level');
        const currentSrc = document.getElementById('currentImage').src;
        const nextImageNumber = currentLevel + 1;
        document.getElementById('currentImage').src = currentSrc.replace(/level\d\.jpg/, `level${nextImageNumber}.jpg`);
        
        if (currentLevel === 3) {
            document.getElementById('nextLevel').disabled = true;
        }
    }
});

document.getElementById('revealAnswer').addEventListener('click', () => {
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
