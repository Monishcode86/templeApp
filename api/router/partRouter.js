const express = require('express');
const {
    addPartController,
    getAllPartsController,
    getPartController,
    updatePartController,
    deletePartController
} = require('../controller/partController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Require JWT authentication for all part operations
router.use(authenticateToken);

// Part Master CRUD endpoints
router.post('/', addPartController);
router.get('/', getAllPartsController);
router.get('/:id', getPartController);
router.put('/:id', updatePartController);
router.delete('/:id', deletePartController);

module.exports = router;
