const {
    addPart,
    getAllParts,
    getPart,
    updatePart,
    deletePart
} = require('../service/partService');

const addPartController = async (req, res, next) => {
    try {
        const data = await addPart(req.body);
        return res.status(201).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const getAllPartsController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id } = req.query;
        const result = await getAllParts({ page, limit, search, plant_id });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getPartController = async (req, res, next) => {
    try {
        const data = await getPart(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updatePartController = async (req, res, next) => {
    try {
        const data = await updatePart(req.body, req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const deletePartController = async (req, res, next) => {
    try {
        const data = await deletePart(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addPartController,
    getAllPartsController,
    getPartController,
    updatePartController,
    deletePartController
};
