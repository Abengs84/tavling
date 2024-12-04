const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const https = require('https');
const socketIO = require('socket.io');

// SSL certificate configuration
const sslOptions = {
    cert: fs.readFileSync('/etc/pki/tls/cert.pem'),
    key: fs.readFileSync('/etc/pki/tls/privkey.pem'),
    ca: fs.readFileSync('/etc/pki/tls/chain.pem')
};

// Admin password - this should be stored securely in production
const ADMIN_PASSWORD = 'REDACTED';

// Track authenticated admin sockets
const authenticatedAdmins = new Set();

app.use((req, res, next) => {
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

const QUESTION_TIMER = 30; // 30 seconds per question

const gameState = {
    questions: [],
    currentQuestionIndex: -1,
    currentQuestion: null,
    players: new Map(), // Map<socketId, {name, score}>
    playerAnswers: new Map(), // Map<questionIndex, Map<playerName, {answer}>
    isGameStarted: false,
    adminSocket: null,
    playerSessions: new Map(), // Map<name, {sessionId, score}>
    timerInterval: null,
    timerStartTime: null,  // Track when timer started
    timeLeft: QUESTION_TIMER,  // Track remaining time
    yearProximities: new Map() // Track year proximities for tiebreaker
};

const POINTS_FOR_CORRECT = 1;
const YEAR_POINTS = 2; // Points for correct year guess

function calculateYearPoints(submittedYear, correctYear) {
    const difference = Math.abs(parseInt(submittedYear) - parseInt(correctYear));
    // Only award points for exact match, but store proximity for potential tiebreaker
    return {
        points: difference === 0 ? YEAR_POINTS : 0,
        proximity: difference
    };
}

function validatePlayerName(name) {
    if (name.length < 3) {
        return { valid: false, error: 'Namnet måste vara minst 3 tecken långt' };
    }
    if (!/^[a-zA-ZåäöÅÄÖ0-9 ]+$/.test(name)) {
        return { valid: false, error: 'Namnet får endast innehålla bokstäver, siffror och mellanslag' };
    }
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

function startTimer() {
    gameState.timerStartTime = Date.now();
    gameState.timeLeft = QUESTION_TIMER;
    io.emit('timer-start', QUESTION_TIMER);
    
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        io.emit('timer-tick', gameState.timeLeft);
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            io.emit('timer-end');
            // Auto-reveal answer when time is up
            setTimeout(() => {
                io.to('admin').emit('time-up');
            }, 1000);
        }
    }, 1000);
}

function getCurrentTimerState() {
    if (!gameState.timerStartTime || !gameState.isGameStarted) {
        return null;
    }
    
    const elapsed = Math.floor((Date.now() - gameState.timerStartTime) / 1000);
    const remaining = Math.max(0, QUESTION_TIMER - elapsed);
    
    return {
        timeLeft: remaining,
        totalTime: QUESTION_TIMER
    };
}

function sendCurrentGameState(socket, playerName = null) {
    if (gameState.isGameStarted && gameState.currentQuestion) {
        const playerAnswer = playerName ? getPlayerAnswer(playerName) : null;
        const hasAnswered = !!playerAnswer;
        const player = playerName ? gameState.players.get(socket.id) : null;
        
        // Get current timer state
        const timerState = getCurrentTimerState();
        
        socket.emit('game-state', {
            currentQuestionIndex: gameState.currentQuestionIndex,
            questionNumber: gameState.currentQuestionIndex + 1,
            totalQuestions: gameState.questions.length,
            questionText: gameState.currentQuestion.question,
            choices: gameState.currentQuestion.choices || [],
            hasAnswered: hasAnswered,
            answer: playerAnswer?.answer || null,
            score: player?.score || 0,
            timerState: timerState,
            questionType: gameState.currentQuestion.type || 'multiple-choice'
        });
    }
}

function sendCurrentPlayers(socket) {
    const players = Array.from(gameState.players.entries()).map(([id, player]) => ({
        id,
        name: player.name,
        score: player.score || 0
    }));
    socket.emit('current-players', players);
}

function broadcastScores() {
    const players = Array.from(gameState.players.entries()).map(([id, player]) => ({
        id,
        name: player.name,
        score: player.score || 0
    }));
    io.to('admin').emit('scores-updated', players);
}

// Create HTTPS server
const server = https.createServer(sslOptions, app);
const io = socketIO(server);

io.on('connection', (socket) => {

    socket.on('admin-login', (password) => {
        if (password === ADMIN_PASSWORD) {
            authenticatedAdmins.add(socket.id);
            socket.emit('admin-login-response', { success: true });
        } else {
            socket.emit('admin-login-response', { success: false });
        }
    });

    socket.on('spectator-join', () => {
        socket.join('spectators');
        if (gameState.isGameStarted) {
            sendCurrentGameState(socket);
        }
    });

    socket.on('verify-session', (sessionData) => {
        const playerSession = gameState.playerSessions.get(sessionData.name);
        const isValid = playerSession !== undefined;
        socket.emit('session-verified', isValid);
        
        if (isValid) {
            playerSession.sessionId = socket.id;
            gameState.players.set(socket.id, {
                name: sessionData.name,
                score: playerSession.score
            });
            socket.join('players');
        }
    });

    socket.on('validate-name', (name) => {
        const validation = validatePlayerName(name);
        socket.emit('name-validation-result', validation);
    });

    socket.on('admin-connect', () => {
        // Check if the socket is authenticated
        if (!authenticatedAdmins.has(socket.id)) {
            socket.emit('admin-login-response', { success: false });
            return;
        }

        socket.join('admin');
        gameState.adminSocket = socket;
        gameState.questions = loadQuestions();
        socket.emit('admin-connected');
        sendCurrentPlayers(socket);
        
        // Send current timer state if game is in progress
        const timerState = getCurrentTimerState();
        if (timerState) {
            socket.emit('timer-sync', timerState);
        }
    });

    socket.on('player-connect', (playerData) => {
        const existingSession = gameState.playerSessions.get(playerData.name);
        if (existingSession) {
            socket.emit('connection-error', 'Du har redan en aktiv session. Vänligen använd den befintliga fliken.');
            return;
        }

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
            name: playerData.name,
            score: 0
        });

        emitPlayerCount();

        if (gameState.isGameStarted) {
            sendCurrentGameState(socket, playerData.name);
        }
    });

    socket.on('reconnect-player', (sessionData) => {
        const playerSession = gameState.playerSessions.get(sessionData.name);
        
        if (playerSession) {
            playerSession.sessionId = socket.id;
            
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

            io.to('admin').emit('player-joined', {
                id: socket.id,
                name: sessionData.name,
                score: playerSession.score
            });

            emitPlayerCount();

            if (gameState.isGameStarted) {
                setTimeout(() => {
                    sendCurrentGameState(socket, sessionData.name);
                }, 500);
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
        gameState.yearProximities.clear();
        
        broadcastScores();
        io.emit('game-started');
        
        setTimeout(() => {
            startNewQuestion();
        }, 1000);
    });

function startNewQuestion() {
    gameState.currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    gameState.playerAnswers.set(gameState.currentQuestionIndex, new Map());

    // Determine if this is a year question
    const isYearQuestion = gameState.currentQuestion.type === 'year';
    const questionType = isYearQuestion ? 'year' : 'multiple-choice';

    // Prepare question data
    const questionData = {
        questionNumber: gameState.currentQuestionIndex + 1,
        totalQuestions: gameState.questions.length,
        questionText: gameState.currentQuestion.question,
        choices: isYearQuestion ? [] : gameState.currentQuestion.choices,
        questionType: questionType
    };

    // Send to admin with additional data
    io.to('admin').emit('new-question', {
        ...questionData,
        correctAnswer: gameState.currentQuestion.correctAnswer
    });

    // Send to players and spectators
    io.to('players').emit('new-question', questionData);
    io.to('spectators').emit('new-question', questionData);

    startTimer();
}

    socket.on('next-question', () => {
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
        }
        
        gameState.currentQuestionIndex++;
        if (gameState.currentQuestionIndex < gameState.questions.length) {
            startNewQuestion();
        } else {
            // Sort players by score first, then by year proximity if tied at 9 points
            const finalPlayers = Array.from(gameState.players.values())
                .sort((a, b) => {
                    if (a.score === b.score && a.score === 8) {
                        // If tied at 8 points, use year proximity as tiebreaker
                        const aProximity = gameState.yearProximities.get(a.name) || Infinity;
                        const bProximity = gameState.yearProximities.get(b.name) || Infinity;
                        return aProximity - bProximity;
                    }
                    return b.score - a.score;
                });
            
            io.emit('game-over', finalPlayers);
            gameState.isGameStarted = false;
            gameState.playerAnswers.clear();
            gameState.playerSessions.clear();
            gameState.timerStartTime = null;
            gameState.yearProximities.clear();
            io.emit('game-ended');
        }
    });

    socket.on('submit-answer', (answer) => {
        const player = gameState.players.get(socket.id);
        if (!player) return;

        if (hasPlayerAnswered(player.name)) {
            socket.emit('answer-error', 'Du har redan svarat på denna fråga');
            return;
        }

        const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
        questionAnswers.set(player.name, { answer: answer });

        io.to('admin').emit('player-answered', {
            playerId: socket.id,
            playerName: player.name,
            answer: answer
        });

        socket.emit('answer-confirmed', { answer: answer });
    });

    socket.on('reveal-answer', () => {
        // Clear timer interval if it's still running
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
            gameState.timerInterval = null;
            io.emit('timer-end');
        }
        
        if (gameState.currentQuestion) {
            const results = [];
            const questionAnswers = gameState.playerAnswers.get(gameState.currentQuestionIndex);
            const isYearQuestion = gameState.currentQuestion.type === 'year';
            
            if (questionAnswers) {
                questionAnswers.forEach((answerData, playerName) => {
                    let points = 0;
                    let isCorrect = false;

                    if (isYearQuestion) {
                        // For the year question, calculate points and proximity
                        const yearResult = calculateYearPoints(answerData.answer, gameState.currentQuestion.correctAnswer);
                        points = yearResult.points;
                        isCorrect = points === YEAR_POINTS;
                        
                        // Store proximity for potential tiebreaker
                        gameState.yearProximities.set(playerName, yearResult.proximity);
                    } else {
                        // For regular questions, exact match required
                        isCorrect = answerData.answer === gameState.currentQuestion.correctAnswer;
                        points = isCorrect ? POINTS_FOR_CORRECT : 0;
                    }
                    
                    const playerEntry = Array.from(gameState.players.entries())
                        .find(([_, p]) => p.name === playerName);
                    
                    if (playerEntry) {
                        const [_, player] = playerEntry;
                        player.score += points;
                        
                        const session = gameState.playerSessions.get(playerName);
                        if (session) {
                            session.score = player.score;
                        }
                        
                        results.push({
                            playerName: playerName,
                            answer: answerData.answer,
                            correct: isCorrect,
                            points: points,
                            totalScore: player.score
                        });
                    }
                });
            }

            broadcastScores();

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
            authenticatedAdmins.delete(socket.id);
        } else {
            const player = gameState.players.get(socket.id);
            if (player) {
                gameState.players.delete(socket.id);
                io.to('admin').emit('player-left', { id: socket.id });
                emitPlayerCount();
            }
        }
    });
});

const PORT = 8060;
const exec = require('child_process').exec;
exec(`lsof -ti:${PORT} | xargs kill -9`, (error) => {
    server.listen(PORT, () => {
        console.log(`HTTPS Server running on port ${PORT}`);
    });
});
