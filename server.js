const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

const gameState = {
    questions: [],
    currentQuestionIndex: -1,
    currentQuestion: null,
    currentLevel: 0,
    players: new Map(), // Map<socketId, {name, score}>
    playerAnswers: new Map(), // Map<questionIndex, Map<playerName, {answer, level}>>
    isGameStarted: false,
    adminSocket: null,
    playerSessions: new Map() // Map<name, {sessionId, score}>
};

const POINTS_PER_LEVEL = [10, 8, 6, 4];

function validatePlayerName(name) {
    if (name.length < 3) {
        return { valid: false, error: 'Namnet måste vara minst 3 tecken långt' };
    }
    // Updated regex to allow Swedish characters
    if (!/^[a-zA-ZåäöÅÄÖ0-9 ]+$/.test(name)) {
        return { valid: false, error: 'Namnet får endast innehålla bokstäver, siffror och mellanslag' };
    }
    // Check if name is taken by an active player (not just in sessions)
    const existingNames = Array.from(gameState.players.values()).map(p => p.name.toLowerCase());
    if (existingNames.includes(name.toLowerCase())) {
        return { valid: false, error: 'Detta namn är redan taget' };
    }
    return { valid: true };
}

function loadQuestions() {
    const questionsPath = path.join(__dirname, 'questions.json');
    const questionsData = fs.readFileSync(questionsPath, 'utf8');
    return JSON.parse(questionsData).questions;
}

function hasPlayerAnswered(playerName) {
    if (!gameState.playerAnswers.has(gameState.currentQuestionIndex)) {
        return false;
    }
    const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
    return questionAnswers.has(playerName);
}

function getPlayerAnswer(playerName) {
    if (!gameState.playerAnswers.has(gameState.currentQuestionIndex)) {
        return null;
    }
    const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
    return questionAnswers.get(playerName);
}

function emitPlayerCount() {
    io.emit('players-updated', gameState.players.size);
}

function sendCurrentGameState(socket, playerName) {
    if (gameState.isGameStarted && gameState.currentQuestion) {
        const playerAnswer = getPlayerAnswer(playerName);
        const hasAnswered = !!playerAnswer;
        const player = gameState.players.get(socket.id);
        socket.emit('game-state', {
            currentQuestionIndex: gameState.currentQuestionIndex,
            questionNumber: gameState.currentQuestionIndex + 1,
            totalQuestions: gameState.questions.length,
            questionText: gameState.currentQuestion.question,
            currentLevel: gameState.currentLevel,
            image: gameState.currentQuestion.images[gameState.currentLevel],
            choices: gameState.currentQuestion.choices,
            hasAnswered: hasAnswered,
            answer: playerAnswer?.answer || null,
            score: player?.score || 0
        });
    }
}

io.on('connection', (socket) => {
    socket.on('validate-name', (name) => {
        const validation = validatePlayerName(name);
        socket.emit('name-validation-result', validation);
    });

    socket.on('admin-connect', () => {
        socket.join('admin');
        gameState.adminSocket = socket;
        gameState.questions = loadQuestions();
        socket.emit('admin-connected');
    });

    socket.on('player-connect', (playerData) => {
        const validation = validatePlayerName(playerData.name);
        if (!validation.valid) {
            socket.emit('connection-error', validation.error);
            return;
        }

        const playerSession = {
            sessionId: socket.id,
            score: 0
        };
        gameState.playerSessions.set(playerData.name, playerSession);
        gameState.players.set(socket.id, {
            name: playerData.name,
            score: 0
        });
        socket.join('players');
        
        socket.emit('player-welcome', {
            name: playerData.name,
            gameInProgress: gameState.isGameStarted,
            sessionId: socket.id
        });

        io.to('admin').emit('player-joined', {
            id: socket.id,
            name: playerData.name
        });

        emitPlayerCount();

        if (gameState.isGameStarted) {
            sendCurrentGameState(socket, playerData.name);
        }
    });

    socket.on('reconnect-player', (sessionData) => {
        const playerSession = gameState.playerSessions.get(sessionData.name);
        
        if (playerSession) {
            // Update session with new socket id
            playerSession.sessionId = socket.id;
            
            // Update or create player entry
            gameState.players.set(socket.id, {
                name: sessionData.name,
                score: playerSession.score
            });
            
            socket.join('players');
            socket.emit('player-welcome', {
                name: sessionData.name,
                gameInProgress: gameState.isGameStarted,
                sessionId: socket.id,
                score: playerSession.score
            });

            emitPlayerCount();

            // Immediately send current game state if game is in progress
            if (gameState.isGameStarted) {
                setTimeout(() => {
                    sendCurrentGameState(socket, sessionData.name);
                }, 500); // Small delay to ensure client is ready
            }
        } else {
            socket.emit('connection-error', 'Session expired. Please enter your name again.');
        }
    });

    socket.on('start-game', () => {
        gameState.players.forEach(player => {
            player.score = 0;
            const session = gameState.playerSessions.get(player.name);
            if (session) {
                session.score = 0;
            }
        });
        gameState.currentQuestionIndex = 0;
        gameState.questions = loadQuestions();
        gameState.isGameStarted = true;
        gameState.playerAnswers.clear();
        
        // First notify all players that game is starting
        io.emit('game-started');
        
        // Then start the first question
        setTimeout(() => {
            startNewQuestion();
        }, 1000); // Delay to allow clients to transition to game page
    });

    function startNewQuestion() {
        gameState.currentQuestion = gameState.questions[gameState.currentQuestionIndex];
        gameState.currentLevel = 0;
        gameState.playerAnswers.set(gameState.currentQuestionIndex, new Map());
        io.emit('new-question', {
            questionNumber: gameState.currentQuestionIndex + 1,
            totalQuestions: gameState.questions.length,
            questionText: gameState.currentQuestion.question,
            level: 0,
            image: gameState.currentQuestion.images[0],
            choices: gameState.currentQuestion.choices
        });
    }

    socket.on('next-question', () => {
        gameState.currentQuestionIndex++;
        if (gameState.currentQuestionIndex < gameState.questions.length) {
            startNewQuestion();
        } else {
            io.emit('game-over', Array.from(gameState.players.values()));
            gameState.isGameStarted = false;
            gameState.playerAnswers.clear();
            gameState.playerSessions.clear();
            io.emit('game-ended');
        }
    });

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
        const player = gameState.players.get(socket.id);
        if (!player) return;

        // Check if player has already answered this question
        if (hasPlayerAnswered(player.name)) {
            socket.emit('answer-error', 'Du har redan svarat på denna fråga');
            return;
        }

        // Store the answer
        const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
        questionAnswers.set(player.name, {
            answer: answer,
            level: gameState.currentLevel
        });

        io.to('admin').emit('player-answered', {
            playerId: socket.id,
            playerName: player.name,
            level: gameState.currentLevel,
            answer: answer
        });

        // Confirm to player their answer was recorded
        socket.emit('answer-confirmed', {
            answer: answer,
            level: gameState.currentLevel
        });
    });

    socket.on('reveal-answer', () => {
        if (gameState.currentQuestion) {
            const results = [];
            const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
            
            if (questionAnswers) {
                questionAnswers.forEach((answerData, playerName) => {
                    const isCorrect = answerData.answer === gameState.currentQuestion.correctAnswer;
                    const points = isCorrect ? POINTS_PER_LEVEL[answerData.level] : 0;
                    
                    // Find player by name
                    const playerEntry = Array.from(gameState.players.entries())
                        .find(([_, p]) => p.name === playerName);
                    
                    if (playerEntry) {
                        const [_, player] = playerEntry;
                        player.score += points;
                        
                        // Update session score
                        const session = gameState.playerSessions.get(playerName);
                        if (session) {
                            session.score = player.score;
                        }
                        
                        results.push({
                            playerName: playerName,
                            answer: answerData.answer,
                            correct: isCorrect,
                            points: points,
                            totalScore: player.score,
                            answeredAtLevel: answerData.level + 1
                        });
                    }
                });
            }

            io.emit('answer-revealed', {
                correctAnswer: gameState.currentQuestion.correctAnswer,
                results: results,
                isLastQuestion: gameState.currentQuestionIndex === gameState.questions.length - 1
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket === gameState.adminSocket) {
            gameState.adminSocket = null;
        } else {
            const player = gameState.players.get(socket.id);
            if (player) {
                // Don't delete the session, just the socket connection
                gameState.players.delete(socket.id);
                io.to('admin').emit('player-left', { id: socket.id });
                emitPlayerCount();
            }
        }
    });
});

const PORT = 3000;
const exec = require('child_process').exec;
exec(`lsof -ti:${PORT} | xargs kill -9`, (error) => {
    http.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
