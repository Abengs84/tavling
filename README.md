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
- View final scores

### Player View
- Join with custom name
- Answer questions within time limit
- See immediate feedback on answers
- View personal score
- See final ranking

### Spectator View (New!)
- Watch quiz in real-time on a 1080p display (16:9)
- See current question and choices
- View countdown timer
- See correct answer when revealed
- View top 10 leaderboard after each question

### Real-time Features
- Live countdown timer with admin control
- Instant answer submission
- Real-time score updates
- Synchronized timer across all views
- Admin can force reveal answers during countdown

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
- Player: Interactive quiz participation
- Spectator: Large-format display for audience viewing

### Timer System
- 30-second countdown per question
- Admin can reveal answer during countdown
- Timer synchronizes across all views
- Visual progress bar with smooth animation

## Recent Updates

### Spectator View
- Added dedicated view for large displays
- 16:9 aspect ratio (1920x1080)
- Shows current question state
- Displays top 10 leaderboard

### Timer Control
- Admin can now reveal answers during countdown
- Timer freezes at current position when answer revealed
- Synchronized stopping across all views

### Leaderboard
- Shows all players with points
- Updates in real-time after each question
- Displays top 10 on spectator view

## Browser Support
- Works on modern browsers with WebSocket support
- Responsive design for different screen sizes
- Optimized for 1080p displays (spectator view)
