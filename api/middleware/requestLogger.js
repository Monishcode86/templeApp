const logger = require('../config/logger');

/**
 * Middleware to log HTTP requests with timing and status code
 */
const requestLogger = (req, res, next) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const durationInMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
        const message = `${req.method} ${req.originalUrl} [${res.statusCode}] - ${durationInMs}ms - IP: ${req.ip || req.socket.remoteAddress}`;

        if (res.statusCode >= 500) {
            logger.error(message);
        } else if (res.statusCode >= 400) {
            logger.warn(message);
        } else {
            logger.info(message);
        }
    });

    next();
};

module.exports = requestLogger;
