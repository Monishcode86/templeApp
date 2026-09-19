const express = require('express');
const loginRoute = require('./loginrouter');
const userRoute = require('./userrouter');
const plantRoute = require('./plantRouter');
const shiftRoute = require('./shiftRouter');
const departmentRoute = require('./departmentRouter');
const partRoute = require('./partRouter');
const downtimeRoute = require('./downtimeRouter');
const machineTypeRoute = require('./machineTypeRouter');
const machineRoute = require('./machineRouter');

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
router.use('/department', departmentRoute);
router.use('/part', partRoute);
router.use('/downtime', downtimeRoute);
router.use('/machinetype', machineTypeRoute);
router.use('/machine', machineRoute);

module.exports = router;
