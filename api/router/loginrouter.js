const express = require('express');
const { loginController, refreshTokenController, getProfileController } = require('../controller/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/login - Authenticate user credentials and return JWT & refresh token
router.post('/', loginController);

// POST /api/login/refresh - Issue new access & refresh tokens using valid refresh token
router.post('/refresh', refreshTokenController);
router.post('/refresh-token', refreshTokenController);

// GET /api/login/me - Get authenticated user profile
router.get('/me', authenticateToken, getProfileController);

module.exports = router;

