const {
    addDonation,
    getAllDonations,
    getDonation,
    updateDonation,
    deleteDonation
} = require('../service/donationService');

const addDonationController = async (req, res, next) => {
    try {
        const data = await addDonation(req.body, req.user);
        return res.status(201).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const getAllDonationsController = async (req, res, next) => {
    try {
        const { page, limit, search, type } = req.query;
        const result = await getAllDonations({ page, limit, search, type });
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return next(error);
    }
};

const getDonationController = async (req, res, next) => {
    try {
        const data = await getDonation(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const updateDonationController = async (req, res, next) => {
    try {
        const data = await updateDonation(req.params.id, req.body);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

const deleteDonationController = async (req, res, next) => {
    try {
        const data = await deleteDonation(req.params.id);
        return res.status(200).json({ status: 'Success', data });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    addDonationController,
    getAllDonationsController,
    getDonationController,
    updateDonationController,
    deleteDonationController
};
