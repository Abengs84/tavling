const config = require('../config');

function calculateYearPoints(submittedYear, correctYear) {
    const difference = Math.abs(parseInt(submittedYear) - parseInt(correctYear));
    return {
        points: difference === 0 ? config.YEAR_POINTS : 0,
        proximity: difference
    };
}

module.exports = {
    calculateYearPoints
};
