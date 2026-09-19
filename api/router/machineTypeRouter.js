const express = require('express');
const {
    addMachineTypeController,
    getAllMachineTypesController,
    getMachineTypeByIdController,
    updateMachineTypeController,
    deleteMachineTypeController
} = require('../controller/machineTypeController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Require JWT authentication for all machine type operations
router.use(authenticateToken);

// Machine Type CRUD endpoints
router.post('/', addMachineTypeController);
router.get('/', getAllMachineTypesController);
router.get('/:id', getMachineTypeByIdController);
router.put('/:id', updateMachineTypeController);
router.delete('/:id', deleteMachineTypeController);

module.exports = router;
