const {
    addDowntimeReason,
    getAllDowntimeReasons,
    getDowntimeReasonById,
    updateDowntimeReason,
    deleteDowntimeReason
} = require('../service/downtimeService');

const addDowntimeController = async (req, res, next) => {
    try {
        const data = await addDowntimeReason(req.body);
        return res.status(201).json({
            status: 'Success',
            message: `${data.downtime_type === 'rejection' ? 'Rejection' : 'Downtime'} reason configured successfully`,
            data
        });
    } catch (error) {
        return next(error);
    }
};

const getAllDowntimeController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id, downtime_type } = req.query;
        const result = await getAllDowntimeReasons({ page, limit, search, plant_id, downtime_type });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getDowntimeByIdController = async (req, res, next) => {
    try {
        const data = await getDowntimeReasonById(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateDowntimeController = async (req, res, next) => {
    try {
        const data = await updateDowntimeReason(req.params.id, req.body);
        return res.status(200).json({
            status: 'Success',
            message: 'Downtime reason updated successfully',
            data
        });
    } catch (error) {
        return next(error);
    }
};

const deleteDowntimeController = async (req, res, next) => {
    try {
        const data = await deleteDowntimeReason(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addDowntimeController,
    getAllDowntimeController,
    getDowntimeByIdController,
    updateDowntimeController,
    deleteDowntimeController
};
