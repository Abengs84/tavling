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
- Multiple choice for standard questions
- Special year input for final question with proximity-based scoring
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

### Scoring System
- Standard Questions (1-9):
  * Fixed points for correct answers
  * No points for incorrect answers

- Final Year Question (Question 10):
  * Proximity-based scoring
  * 10 points for exact match
  * -1 point per decade difference from correct year
  * Examples:
    - 1606 = 10 points (exact match)
    - 1610 = 9 points (4 years off)
    - 1620 = 8 points (14 years off)
    - 1650 = 5 points (44 years off)
    - 1706 = 0 points (100 years off)
  * Helps differentiate tied players based on historical knowledge

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## SSL Certificates

The server uses HTTPS with SSL certificates from Synology NAS. The certificates should be available at:
- `/etc/pki/tls/cert.pem` - Server certificate
- `/etc/pki/tls/privkey.pem` - Private key

The server needs read access to these files, so it should be run with appropriate permissions:
```bash
sudo node server.js
```

## Running the Server

Start the server using either:
```bash
npm start
```
or with SSL certificates:
```bash
sudo node server.js
```

## Accessing the Quiz

- Players join at: https://localhost:8060
- Admin interface at: https://localhost:8060/admin.html
- Spectator view at: https://localhost:8060/spectator.html

Note: The server now uses HTTPS on port 8060 for secure connections.

## Customizing Questions

Edit the `questions.json` file to modify quiz questions. Each question should have:
- Question text
- Multiple choice answers or year input type
- Correct answer

Example format:
```json
{
  "questions": [
    {
      "question": "Your question here?",
      "choices": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option 1"
    },
    {
      "question": "What year was Vasa founded?",
      "type": "year",
      "correctAnswer": "1606"
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

### Input Validation
- Multiple choice: Single selection with immediate feedback
- Year input: 
  * Validates 4-digit year format
  * Immediate visual feedback
  * Answer locks after submission
  * Clear error messages for invalid input

## Recent Updates

### Year Input Question
- Special input field for final question
- Proximity-based scoring system
- Immediate visual feedback and answer locking
- Keyboard support with Enter key
- Improved UI with single-column layout

### HTTPS Support
- Secure connections using Synology NAS SSL certificates
- WebSocket communication over secure protocol
- Protected player data and game interactions

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
- Detailed breakdown of proximity-based scoring for year question

## Browser Support
- Works on modern browsers with WebSocket support
- Responsive design for different screen sizes
- Optimized for 1080p displays (spectator view)
