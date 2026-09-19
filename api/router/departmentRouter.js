const express = require('express');
const {
    addDepartmentController,
    getAllDepartmentsController,
    getDepartmentController,
    updateDepartmentController,
    deleteDepartmentController
} = require('../controller/departmentController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Require JWT authentication for all department operations
router.use(authenticateToken);

// Department CRUD endpoints
router.post('/', addDepartmentController);
router.get('/', getAllDepartmentsController);
router.get('/:id', getDepartmentController);
router.put('/:id', updateDepartmentController);
router.delete('/:id', deleteDepartmentController);

module.exports = router;
