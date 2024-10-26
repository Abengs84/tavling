const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

const gameState = {
    questions: [],
    currentQuestionIndex: -1,
    currentQuestion: null,
    currentLevel: 0,
    players: new Map(),
    answers: new Map(),
    scores: new Map(),
    isGameStarted: false,
    adminSocket: null
};

// Fixed points per level
const POINTS_PER_LEVEL = [10, 8, 6, 4];

// Load questions from JSON file
function loadQuestions() {
    const questionsPath = path.join(__dirname, 'questions.json');
    const questionsData = fs.readFileSync(questionsPath, 'utf8');
    return JSON.parse(questionsData).questions;
}

// Send current game state to a client
function sendGameState(socket, isAdmin = false) {
    if (gameState.isGameStarted) {
        const stateData = {
            currentQuestionIndex: gameState.currentQuestionIndex,
            currentLevel: gameState.currentLevel,
            questionNumber: gameState.currentQuestionIndex + 1,
            totalQuestions: gameState.questions.length,
            questionText: gameState.currentQuestion.question,
            image: gameState.currentQuestion.images[gameState.currentLevel],
            choices: gameState.currentQuestion.choices,
            players: Array.from(gameState.players.values()),
            answers: isAdmin ? Array.from(gameState.answers.entries()) : []
        };
        socket.emit('restore-game-state', stateData);
    }
}

io.on('connection', (socket) => {
    socket.on('admin-connect', () => {
        socket.join('admin');
        gameState.adminSocket = socket;
        gameState.questions = loadQuestions();
        socket.emit('admin-connected');
        if (gameState.isGameStarted) {
            sendGameState(socket, true);
        }
    });

    socket.on('player-connect', (playerData) => {
        const existingPlayer = Array.from(gameState.players.entries()).find(([_, p]) => p.name === playerData.name);
        if (existingPlayer) {
            // Restore existing player's state
            const [oldId, playerInfo] = existingPlayer;
            gameState.players.delete(oldId);
            gameState.players.set(socket.id, playerInfo);
            socket.emit('player-restored', {
                score: playerInfo.score,
                hasAnswered: gameState.answers.has(oldId)
            });
        } else {
            // Create new player
            gameState.players.set(socket.id, {
                name: playerData.name,
                score: 0
            });
        }
        socket.join('players');
        io.to('admin').emit('player-joined', {
            id: socket.id,
            name: playerData.name
        });
        if (gameState.isGameStarted) {
            sendGameState(socket);
        }
    });

    socket.on('start-game', () => {
        gameState.currentQuestionIndex = 0;
        gameState.questions = loadQuestions();
        gameState.isGameStarted = true;
        startNewQuestion();
    });

    socket.on('next-question', () => {
        gameState.currentQuestionIndex++;
        if (gameState.currentQuestionIndex < gameState.questions.length) {
            startNewQuestion();
        } else {
            io.emit('game-over', Array.from(gameState.players.values()));
            gameState.isGameStarted = false;
        }
    });

    function startNewQuestion() {
        gameState.currentQuestion = gameState.questions[gameState.currentQuestionIndex];
        gameState.currentLevel = 0;
        gameState.answers.clear();
        io.emit('new-question', {
            questionNumber: gameState.currentQuestionIndex + 1,
            totalQuestions: gameState.questions.length,
            questionText: gameState.currentQuestion.question,
            level: 0,
            image: gameState.currentQuestion.images[0],
            choices: gameState.currentQuestion.choices
        });
    }

    socket.on('next-level', () => {
        if (gameState.currentQuestion && gameState.currentLevel < 3) {
            gameState.currentLevel++;
            io.to('players').emit('show-level', {
                level: gameState.currentLevel,
                image: gameState.currentQuestion.images[gameState.currentLevel]
            });
        }
    });

    socket.on('submit-answer', (answer) => {
        if (!gameState.answers.has(socket.id) && gameState.currentQuestion) {
            const player = gameState.players.get(socket.id);
            gameState.answers.set(socket.id, {
                playerName: player.name,
                answer: answer,
                level: gameState.currentLevel
            });
            io.to('admin').emit('player-answered', {
                playerId: socket.id,
                playerName: player.name,
                level: gameState.currentLevel,
                answer: answer
            });
        }
    });

    socket.on('reveal-answer', () => {
        if (gameState.currentQuestion) {
            const results = [];
            
            gameState.answers.forEach((answer, playerId) => {
                const isCorrect = answer.answer === gameState.currentQuestion.correctAnswer;
                const points = isCorrect ? POINTS_PER_LEVEL[answer.level] : 0;
                const player = gameState.players.get(playerId);
                if (player) {
                    player.score += points;
                    results.push({
                        playerName: answer.playerName,
                        answer: answer.answer,
                        correct: isCorrect,
                        points: points,
                        totalScore: player.score,
                        answeredAtLevel: answer.level + 1
                    });
                }
            });

            io.emit('answer-revealed', {
                correctAnswer: gameState.currentQuestion.correctAnswer,
                results: results,
                isLastQuestion: gameState.currentQuestionIndex === gameState.questions.length - 1
            });
        }
    });

    socket.on('disconnect', () => {
        // Don't remove players on disconnect to allow reconnection
        if (socket === gameState.adminSocket) {
            gameState.adminSocket = null;
        }
    });
});

// Kill any existing process on port 3000 (Linux/Unix only)
const PORT = 3000;
const exec = require('child_process').exec;
exec(`lsof -ti:${PORT} | xargs kill -9`, (error) => {
    http.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
