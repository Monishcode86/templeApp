const { login, refreshAccessToken } = require('../service/authService');

const loginController = async (req, res, next) => {
    try {
        const result = await login(req.body);
        return res.status(200).json({
            status: 'Success',
            message: 'Authentication successful',
            data: result
        });
    } catch (error) {
        return next(error);
    }
};

const refreshTokenController = async (req, res, next) => {
    try {
        const token = req.body.refreshToken || req.headers['x-refresh-token'];
        const result = await refreshAccessToken(token);
        return res.status(200).json({
            status: 'Success',
            message: 'Token refreshed successfully',
            data: result
        });
    } catch (error) {
        return next(error);
    }
};

const getProfileController = async (req, res, next) => {
    try {
        return res.status(200).json({
            status: 'Success',
            data: req.user
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    loginController,
    refreshTokenController,
    getProfileController
};

