const {
    addDepartment,
    getAllDepartments,
    getDepartment,
    updateDepartment,
    deleteDepartment
} = require('../service/departmentService');

const addDepartmentController = async (req, res, next) => {
    try {
        const data = await addDepartment(req.body);
        return res.status(201).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const getAllDepartmentsController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id } = req.query;
        const result = await getAllDepartments({ page, limit, search, plant_id });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination || null
        });
    } catch (error) {
        return next(error);
    }
};

const getDepartmentController = async (req, res, next) => {
    try {
        const data = await getDepartment(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateDepartmentController = async (req, res, next) => {
    try {
        const data = await updateDepartment(req.body, req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const deleteDepartmentController = async (req, res, next) => {
    try {
        const data = await deleteDepartment(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addDepartmentController,
    getAllDepartmentsController,
    getDepartmentController,
    updateDepartmentController,
    deleteDepartmentController
};
