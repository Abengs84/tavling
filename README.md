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
- Special year input for final question
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
- Standard Questions (1-8):
  * 1 point for correct answers
  * No points for incorrect answers

- Final Year Question (Question 9):
  * 2 points for exact match only
  * No points for incorrect answers
  * For players tied at 8 points, proximity to correct year is used as a tiebreaker
  * Example:
    - If Player A and Player B both have 9 points:
    - Player A guesses 1800 (4 years off)
    - Player B guesses 1810 (6 years off)
    - Player A wins the tiebreaker due to closer guess
    - Note: No additional points are awarded for proximity

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

### Configuration Refactoring
- Moved all configuration constants to separate config.js file
- Centralized SSL, server, and game settings
- Improved maintainability and configuration management

### Year Question Scoring Update
- Changed to simple 2-point system for exact matches
- Added internal tiebreaker system using proximity for players tied at 8 points
- Removed previous 10-point proximity-based scoring system
- No points awarded for non-exact matches

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
- Final rankings consider proximity-based tiebreaker for players tied at 8 points

## Browser Support
- Works on modern browsers with WebSocket support
- Responsive design for different screen sizes
- Optimized for 1080p displays (spectator view)
