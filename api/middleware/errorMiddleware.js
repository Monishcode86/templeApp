const logger = require('../config/logger');

/**
 * Centralized Error Handling Middleware for Express
 */
const errorMiddleware = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Mongoose Validation Errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map((e) => e.message).join(', ');
    }

    // Handle Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid format for resource ID: ${err.value}`;
    }

    // Handle Mongo Duplicate Key Error (E11000)
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        message = `Duplicate value entered for '${field}'. Please provide another value.`;
    }

    // Handle JWT Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid authentication token.';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Authentication token has expired.';
    }

    // Log the error to Winston (auto-written to error-YYYY-MM-DD.log)
    logger.error(`[${req.method} ${req.originalUrl}] - Status: ${statusCode} - Error: ${message}`, {
        stack: err.stack,
        body: req.body,
        params: req.params,
        query: req.query
    });

    return res.status(statusCode).json({
        status: 'Error',
        statusCode,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorMiddleware;
