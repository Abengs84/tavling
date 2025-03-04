const socket = io();
let currentLevel = 0;
let gameStarted = false;
let answerRevealed = false;
let correctAnswer = null;
const playerAnswers = new Map();

const STARS_PER_LEVEL = [
    '★★★★',
    '★★★✰',
    '★★✰✰',
    '★✰✰✰'
];

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
    document.getElementById('currentStars').textContent = '';
    playerAnswers.clear();
    correctAnswer = null;
    answerRevealed = false;
}

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
    const imageElement = document.getElementById('currentImage');
    imageElement.style.display = 'block';
    imageElement.src = data.image;
    document.getElementById('answersList').innerHTML = '';
    document.getElementById('currentStars').textContent = STARS_PER_LEVEL[0];
    playerAnswers.clear();
    currentLevel = 0;
    answerRevealed = false;
    
    document.getElementById('startGame').disabled = true;
    document.getElementById('nextLevel').disabled = false;
    document.getElementById('revealAnswer').disabled = true; // Start with reveal disabled
    document.getElementById('nextQuestion').disabled = true;
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
    
    // Sort answers by level
    const sortedAnswers = Array.from(playerAnswers.values())
        .sort((a, b) => a.level - b.level);
    
    sortedAnswers.forEach(answer => {
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
                <span class="level-badge">
                    ${STARS_PER_LEVEL[answer.level]}
                </span>
                ${answerStatus}
            </div>
        `;
        answersList.appendChild(div);
    });
}

socket.on('answer-revealed', (data) => {
    answerRevealed = true;
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
        <h2>Slutresultat</h2>
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
        document.getElementById('currentStars').textContent = STARS_PER_LEVEL[currentLevel];
        
        // Enable reveal answer only when all levels have been shown
        if (currentLevel === 3) {
            document.getElementById('nextLevel').disabled = true;
            document.getElementById('revealAnswer').disabled = false;
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
