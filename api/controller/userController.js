const { adduser, getalluser, getuser, updateuser, deleteuser } = require('../service/userService');

const adduserController = async (req, res, next) => {
    try {
        const data = await adduser(req.body, req.user);
        return res.status(201).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const getalluserController = async (req, res, next) => {
    try {
        const { page, limit, search, plant_id } = req.query;
        const result = await getalluser({ page, limit, search, plant_id }, req.user);
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return next(error);
    }
};

const getuserController = async (req, res, next) => {
    try {
        const params = req.params.id;
        const data = await getuser(params, req.user);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateuserController = async (req, res, next) => {
    try {
        const params = req.params.id;
        const data = await updateuser(req.body, params);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const deleteuserController = async (req, res, next) => {
    try {
        const params = req.params.id;
        const data = await deleteuser(params);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const uploadAvatarController = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No avatar image file provided.');
            error.statusCode = 400;
            return next(error);
        }
        const fileUrl = `/uploads/users/${req.file.filename}`;
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
    adduserController,
    getalluserController,
    getuserController,
    updateuserController,
    deleteuserController,
    uploadAvatarController
};
