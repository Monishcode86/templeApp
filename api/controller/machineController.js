const {
    addMachine,
    getAllMachines,
    getMachineById,
    updateMachine,
    deleteMachine
} = require('../service/machineService');

const addMachineController = async (req, res, next) => {
    try {
        const data = await addMachine(req.body);
        return res.status(201).json({
            status: 'Success',
            message: 'Machine configured successfully',
            data
        });
    } catch (error) {
        return next(error);
    }
};

const getAllMachinesController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id, department_id, machinetype } = req.query;
        const result = await getAllMachines({ page, limit, search, plant_id, department_id, machinetype });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getMachineByIdController = async (req, res, next) => {
    try {
        const data = await getMachineById(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateMachineController = async (req, res, next) => {
    try {
        const data = await updateMachine(req.params.id, req.body);
        return res.status(200).json({
            status: 'Success',
            message: 'Machine updated successfully',
            data
        });
    } catch (error) {
        return next(error);
    }
};

const deleteMachineController = async (req, res, next) => {
    try {
        const data = await deleteMachine(req.params.id);
        return res.status(200).json({
            status: 'Success',
            message: data.message || 'Machine deleted successfully'
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addMachineController,
    getAllMachinesController,
    getMachineByIdController,
    updateMachineController,
    deleteMachineController
};
