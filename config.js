const fs = require('fs');
const path = require('path');

// SSL certificate configuration
const sslOptions = {
    cert: fs.readFileSync('/etc/pki/tls/cert.pem'),
    key: fs.readFileSync('/etc/pki/tls/privkey.pem'),
    ca: fs.readFileSync('/etc/pki/tls/chain.pem')
};

// Game configuration
module.exports = {
    // Server settings
    ADMIN_PASSWORD: 'REDACTED',
    PORT: 8060,
    SSL_OPTIONS: sslOptions,

    // Game settings
    QUESTION_TIMER: 30,  // 30 seconds per question
    POINTS_FOR_CORRECT: 1,
    YEAR_POINTS: 2  // Points for correct year guess
};
