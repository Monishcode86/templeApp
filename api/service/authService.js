const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'users';

/**
 * Authenticate user credentials with either Email or Employee ID, and return a signed JWT
 */
const login = async (credentials = {}) => {
    const identifier = (credentials.identifier || credentials.email || credentials.user_id || credentials.employee_id || '').trim();
    const password = credentials.password;

    if (!identifier || !password) {
        const error = new Error('Email or User ID, and password are required.');
        error.statusCode = 400;
        throw error;
    }

    // Search user by email, user_id, or legacy employee_id
    const cleanEmail = identifier.toLowerCase();
    const user = await commonDao.findOneData(
        {
            query: {
                $or: [
                    { email: cleanEmail },
                    { user_id: identifier },
                    { employee_id: identifier }
                ]
            }
        },
        SCHEMA_NAME
    );

    if (!user) {
        const error = new Error('Invalid email, User ID, or password.');
        error.statusCode = 401;
        throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        logger.warn(`Failed login attempt for: ${identifier}`);
        const error = new Error('Invalid email, User ID, or password.');
        error.statusCode = 401;
        throw error;
    }

    // Only ADMIN role is allowed to log into this application
    if (user.role !== 'ADMIN') {
        logger.warn(`Login rejected: User '${identifier}' does not have ADMIN role (role: ${user.role})`);
        const error = new Error('Access denied. Only administrators are allowed to sign in.');
        error.statusCode = 403;
        throw error;
    }

    const jwtSecret = process.env.JWT_SECRET || 'node24api_jwt_secret_fallback';
    const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || `${jwtSecret}_refresh`;
    const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

    const tokenPayload = {
        userId: user._id,
        email: user.email,
        role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: accessTokenExpiresIn });
    const refreshToken = jwt.sign(tokenPayload, refreshTokenSecret, { expiresIn: refreshTokenExpiresIn });

    logger.info(`User logged in successfully: ${user.username} (UserID: ${user.user_id || user.employee_id || 'N/A'})`);

    return {
        accessToken,
        refreshToken,
        token: accessToken, // Backward compatibility
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            user_id: user.user_id || user.employee_id || null,
            employee_id: user.user_id || user.employee_id || null,
            image: user.image || null,
            address: user.address || null,
            address_line1: user.address_line1 || null,
            address_line2: user.address_line2 || null,
            nation: user.nation || null,
            state: user.state || null,
            city: user.city || null,
            pincode: user.pincode || null,
            country_code: user.country_code || '+91',
            mobile_number: user.mobile_number || null,
            alt_country_code: user.alt_country_code || '+91',
            alt_mobile_number: user.alt_mobile_number || null,
            family_data: user.family_data || []
        }
    };
};

/**
 * Validate refresh token and issue new access & refresh tokens
 */
const refreshAccessToken = async (incomingRefreshToken) => {
    if (!incomingRefreshToken) {
        const error = new Error('Refresh token is required.');
        error.statusCode = 400;
        throw error;
    }

    const jwtSecret = process.env.JWT_SECRET || 'node24api_jwt_secret_fallback';
    const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || `${jwtSecret}_refresh`;
    const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

    let decoded;
    try {
        decoded = jwt.verify(incomingRefreshToken, refreshTokenSecret);
    } catch (err) {
        logger.warn(`Invalid or expired refresh token attempt: ${err.message}`);
        const error = new Error('Invalid or expired refresh token. Please log in again.');
        error.statusCode = 401;
        throw error;
    }

    // Verify user still exists in database
    const user = await commonDao.findOneData(
        {
            query: { _id: decoded.userId }
        },
        SCHEMA_NAME
    );

    if (!user) {
        const error = new Error('User associated with this refresh token no longer exists.');
        error.statusCode = 401;
        throw error;
    }

    // Only ADMIN role is allowed to access
    if (user.role !== 'ADMIN') {
        const error = new Error('Access denied. Only administrators are allowed to sign in.');
        error.statusCode = 403;
        throw error;
    }

    const tokenPayload = {
        userId: user._id,
        email: user.email,
        role: user.role
    };

    const newAccessToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: accessTokenExpiresIn });
    const newRefreshToken = jwt.sign(tokenPayload, refreshTokenSecret, { expiresIn: refreshTokenExpiresIn });

    logger.info(`Access token refreshed for user: ${user.username}`);

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        token: newAccessToken,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            user_id: user.user_id || user.employee_id || null,
            employee_id: user.user_id || user.employee_id || null,
            image: user.image || null,
            address: user.address || null,
            address_line1: user.address_line1 || null,
            address_line2: user.address_line2 || null,
            nation: user.nation || null,
            state: user.state || null,
            city: user.city || null,
            pincode: user.pincode || null,
            country_code: user.country_code || '+91',
            mobile_number: user.mobile_number || null,
            alt_country_code: user.alt_country_code || '+91',
            alt_mobile_number: user.alt_mobile_number || null,
            family_data: user.family_data || []
        }
    };
};

module.exports = {
    login,
    refreshAccessToken
};
