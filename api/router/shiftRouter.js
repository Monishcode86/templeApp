const express = require('express');
const {
    addShiftController,
    getAllShiftsController,
    getShiftController,
    updateShiftController,
    deleteShiftController
} = require('../controller/shiftController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Require JWT authentication for all shift operations
router.use(authenticateToken);

// Shift CRUD endpoints
router.post('/', addShiftController);
router.get('/', getAllShiftsController);
router.get('/:id', getShiftController);
router.put('/:id', updateShiftController);
router.delete('/:id', deleteShiftController);

module.exports = router;
