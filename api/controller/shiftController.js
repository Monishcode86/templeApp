const {
    addShift,
    getAllShifts,
    getShift,
    updateShift,
    deleteShift
} = require('../service/shiftService');

const addShiftController = async (req, res, next) => {
    try {
        const data = await addShift(req.body);
        return res.status(201).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const getAllShiftsController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id } = req.query;
        const result = await getAllShifts({ page, limit, search, plant_id });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getShiftController = async (req, res, next) => {
    try {
        const data = await getShift(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateShiftController = async (req, res, next) => {
    try {
        const data = await updateShift(req.body, req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const deleteShiftController = async (req, res, next) => {
    try {
        const data = await deleteShift(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addShiftController,
    getAllShiftsController,
    getShiftController,
    updateShiftController,
    deleteShiftController
};
