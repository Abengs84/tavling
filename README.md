# tavling
### Web-based real-time 'På spåret' quiz with Node.js

A real-time quiz application with admin control, player participation, and spectator view.

## Features

### Admin Interface
- Control quiz flow and timing
- Start/stop game
- View all player answers in real-time
- Reveal answers at any time during countdown
- Move to next question
- View all scores and answers for game management

### Player View
- Join with custom name
- Answer questions within time limit
- See confirmation when time runs out
- View final scores at game end

### Spectator View
- Watch quiz in real-time on a 1080p display (16:9)
- See current question and choices
- View countdown timer
- Keep choices visible after answer reveal
- View final leaderboard at game end

### Real-time Features
- Live countdown timer with admin control
- Instant answer submission
- Synchronized timer across all views
- Admin can force reveal answers during countdown
- "Tiden är ute" confirmation after countdown

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running the Server

Start the server using either:
```bash
npm start
```
or
```bash
node server.js
```

## Accessing the Quiz

- Players join at: http://localhost:3000
- Admin interface at: http://localhost:3000/admin.html
- Spectator view at: http://localhost:3000/spectator.html

## Customizing Questions

Edit the `questions.json` file to modify quiz questions. Each question should have:
- Question text
- Multiple choice answers
- Correct answer

Example format:
```json
{
  "questions": [
    {
      "question": "Your question here?",
      "choices": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option 1"
    }
  ]
}
```

## Technical Details

### WebSocket Events
- Real-time communication using Socket.IO
- Event-driven architecture for instant updates
- Synchronized timer across all clients

### Views
- Admin: Full game control and player monitoring
- Player: Interactive quiz participation with hidden scores
- Spectator: Large-format display focused on questions

### Timer System
- 30-second countdown per question
- Admin can reveal answer during countdown
- Timer synchronizes across all views
- Visual progress bar with smooth animation
- Clear "Tiden är ute" message after countdown

## Recent Updates

### Hide Points Feature
- Points hidden during gameplay for increased suspense
- No leaderboard updates during game
- Choices remain visible in spectator view after answer reveal
- Clear "Tiden är ute" message when time runs out
- All scores and rankings revealed only at game end

### Timer Control
- Admin can reveal answers during countdown
- Timer freezes at current position when answer revealed
- Synchronized stopping across all views
- Persistent time-up message until next question

### Final Results
- Complete scores shown only at game end

## Browser Support
- Works on modern browsers with WebSocket support
- Responsive design for different screen sizes
- Optimized for 1080p displays (spectator view)
