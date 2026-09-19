const express = require('express');
const {
    addPlantController,
    getAllPlantsController,
    getPlantController,
    updatePlantController,
    deletePlantController,
    uploadPlantImageController
} = require('../controller/plantController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadPlantImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Require JWT authentication for all plant operations
router.use(authenticateToken);

// Plant CRUD endpoints
router.post('/', addPlantController);
router.get('/', getAllPlantsController);
router.post('/upload-image', uploadPlantImage.single('plant_img'), uploadPlantImageController);
router.get('/:id', getPlantController);
router.put('/:id', updatePlantController);
router.delete('/:id', deletePlantController);

module.exports = router;
