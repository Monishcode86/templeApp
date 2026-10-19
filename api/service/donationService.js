const mongoose = require('mongoose');
const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'donations';
const USER_SCHEMA = 'users';

/**
 * Create a new donation record (Only ADMIN)
 */
const addDonation = async (data, currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only ADMIN users can record donations.');
        error.statusCode = 403;
        throw error;
    }

    const { user_id, type, amount, remarks, whatsapp_send, date } = data;

    if (!user_id || !user_id.trim()) {
        const error = new Error('User ID is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!type || !['UPI', 'Cash', 'Cheque'].includes(type)) {
        const error = new Error('Donation type must be UPI, Cash, or Cheque.');
        error.statusCode = 400;
        throw error;
    }

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        const error = new Error('Amount must be a positive number.');
        error.statusCode = 400;
        throw error;
    }

    // Verify user exists and get their username
    const trimmedId = user_id.trim();
    const orConditions = [{ user_id: trimmedId }];
    if (mongoose.Types.ObjectId.isValid(trimmedId)) {
        orConditions.push({ _id: trimmedId });
    }

    const user = await commonDao.findOneData(
        { query: orConditions.length > 1 ? { $or: orConditions } : orConditions[0] },
        USER_SCHEMA
    );
    if (!user) {
        const error = new Error(`User with ID '${user_id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    let parsedDate = new Date();
    if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
            parsedDate = d;
        }
    }

    const payload = {
        user_id: user.user_id || user_id.trim(),
        username: user.username,
        type: type.trim(),
        amount: parsedAmount,
        remarks: remarks && remarks.trim() ? remarks.trim() : null,
        whatsapp_send: whatsapp_send === true || whatsapp_send === 'true' ? true : false,
        date: parsedDate
    };

    const created = await commonDao.insertOne(payload, SCHEMA_NAME);
    logger.info(`Donation created: ${created._id} for user ${user.username} (${user.user_id})`);
    return created;
};

/**
 * Get all donations with pagination and search
 */
const getAllDonations = async (params = {}) => {
    const conditions = [];

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        conditions.push({
            $or: [
                { user_id: searchRegex },
                { username: searchRegex },
                { type: searchRegex },
                { remarks: searchRegex }
            ]
        });
    }

    if (params.type && ['UPI', 'Cash', 'Cheque'].includes(params.type)) {
        conditions.push({ type: params.type });
    }

    const query = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));

    return await commonDao.findWithPagination(
        { query, page, limit, sort: { date: -1, createdAt: -1 } },
        SCHEMA_NAME
    );
};

/**
 * Get single donation by ID
 */
const getDonation = async (id) => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error(`Invalid donation ID.`);
        error.statusCode = 400;
        throw error;
    }
    const donation = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!donation) {
        const error = new Error(`Donation with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }
    return donation;
};

/**
 * Update a donation — only type and remarks are updatable
 */
const updateDonation = async (id, data) => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error(`Invalid donation ID.`);
        error.statusCode = 400;
        throw error;
    }
    const donation = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!donation) {
        const error = new Error(`Donation with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    const payload = {};

    if (data.type !== undefined) {
        if (!['UPI', 'Cash', 'Cheque'].includes(data.type)) {
            const error = new Error('Donation type must be UPI, Cash, or Cheque.');
            error.statusCode = 400;
            throw error;
        }
        payload.type = data.type;
    }

    if (data.remarks !== undefined) {
        payload.remarks = data.remarks && data.remarks.trim() ? data.remarks.trim() : null;
    }

    await commonDao.updateOne(
        { filter: { _id: id }, update: { $set: payload } },
        SCHEMA_NAME
    );

    logger.info(`Donation updated: ${id}`);
    return await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
};

/**
 * Delete a donation
 */
const deleteDonation = async (id) => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error(`Invalid donation ID.`);
        error.statusCode = 400;
        throw error;
    }
    const donation = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!donation) {
        const error = new Error(`Donation with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }
    await commonDao.deleteOne({ _id: id }, SCHEMA_NAME);
    logger.info(`Donation deleted: ${id}`);
    return { message: 'Donation deleted successfully', id };
};

module.exports = {
    addDonation,
    getAllDonations,
    getDonation,
    updateDonation,
    deleteDonation
};
