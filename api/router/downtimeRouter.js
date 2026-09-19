const express = require('express');
const {
    addDowntimeController,
    getAllDowntimeController,
    getDowntimeByIdController,
    updateDowntimeController,
    deleteDowntimeController
} = require('../controller/downtimeController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Require JWT authentication for all downtime operations
router.use(authenticateToken);

// Downtime Master CRUD endpoints
router.post('/', addDowntimeController);
router.get('/', getAllDowntimeController);
router.get('/:id', getDowntimeByIdController);
router.put('/:id', updateDowntimeController);
router.delete('/:id', deleteDowntimeController);

module.exports = router;
