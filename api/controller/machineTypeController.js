const {
    addMachineType,
    getAllMachineTypes,
    getMachineTypeById,
    updateMachineType,
    deleteMachineType
} = require('../service/machineTypeService');

const addMachineTypeController = async (req, res, next) => {
    try {
        const data = await addMachineType(req.body);
        return res.status(201).json({
            status: 'Success',
            message: 'Machine type configured successfully',
            data
        });
    } catch (error) {
        return next(error);
    }
};

const getAllMachineTypesController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id } = req.query;
        const result = await getAllMachineTypes({ page, limit, search, plant_id });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getMachineTypeByIdController = async (req, res, next) => {
    try {
        const data = await getMachineTypeById(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateMachineTypeController = async (req, res, next) => {
    try {
        const data = await updateMachineType(req.params.id, req.body);
        return res.status(200).json({
            status: 'Success',
            message: 'Machine type updated successfully',
            data
        });
    } catch (error) {
        return next(error);
    }
};

const deleteMachineTypeController = async (req, res, next) => {
    try {
        const data = await deleteMachineType(req.params.id);
        return res.status(200).json({
            status: 'Success',
            message: data.message || 'Machine type deleted successfully'
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addMachineTypeController,
    getAllMachineTypesController,
    getMachineTypeByIdController,
    updateMachineTypeController,
    deleteMachineTypeController
};
