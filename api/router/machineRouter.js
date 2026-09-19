const express = require('express');
const {
    addMachineController,
    getAllMachinesController,
    getMachineByIdController,
    updateMachineController,
    deleteMachineController
} = require('../controller/machineController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Require JWT authentication for all machine endpoints
router.use(authenticateToken);

// Machine CRUD endpoints
router.post('/', addMachineController);
router.get('/', getAllMachinesController);
router.get('/:id', getMachineByIdController);
router.put('/:id', updateMachineController);
router.delete('/:id', deleteMachineController);

module.exports = router;
