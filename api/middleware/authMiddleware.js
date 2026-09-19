const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * Middleware to authenticate requests using JWT Bearer token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        const error = new Error('Access denied. No token provided.');
        error.statusCode = 401;
        return next(error);
    }

    const secret = process.env.JWT_SECRET || 'node24api_jwt_secret_fallback';

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return next(err);
        }
        req.user = decoded;
        next();
    });
};

/**
 * Middleware to restrict access to specific roles (e.g. 'ADMIN')
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            const error = new Error('Forbidden: You do not have sufficient permissions to perform this action.');
            error.statusCode = 403;
            return next(error);
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles
};
