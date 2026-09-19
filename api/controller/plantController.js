const {
    addPlant,
    getAllPlants,
    getPlant,
    updatePlant,
    deletePlant
} = require('../service/plantService');

const addPlantController = async (req, res, next) => {
    try {
        const data = await addPlant(req.body);
        return res.status(201).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const getAllPlantsController = async (req, res, next) => {
    try {
        const { page, limit, search } = req.query;
        const result = await getAllPlants({ page, limit, search });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getPlantController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const data = await getPlant(id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updatePlantController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const data = await updatePlant(req.body, id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const deletePlantController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const data = await deletePlant(id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const uploadPlantImageController = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No image file provided.');
            error.statusCode = 400;
            return next(error);
        }
        const fileUrl = `/uploads/plants/${req.file.filename}`;
        return res.status(200).json({
            status: 'Success',
            imageUrl: fileUrl,
            filename: req.file.filename
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addPlantController,
    getAllPlantsController,
    getPlantController,
    updatePlantController,
    deletePlantController,
    uploadPlantImageController
};
