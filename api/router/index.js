const express = require('express');
const loginRoute = require('./loginrouter');
const userRoute = require('./userrouter');
const plantRoute = require('./plantRouter');
const shiftRoute = require('./shiftRouter');

const router = express.Router();

// Health check endpoint for monitoring, load balancers, and Docker/PM2 probes
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Mount modular sub-routers
router.use('/login', loginRoute);
router.use('/user', userRoute);
router.use('/plant', plantRoute);
router.use('/shift', shiftRoute);

module.exports = router;
