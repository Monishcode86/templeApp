const mongoose = require('mongoose');
const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');
const { toEnglishWords, toTamilWords } = require('../utils/numberToWords');

const SCHEMA_NAME = 'donations';
const USER_SCHEMA = 'users';

/**
 * Calculate Indian Financial Year (April 1 to March 31)
 */
const getFinancialYear = (date) => {
    const d = new Date(date || Date.now());
    const year = d.getFullYear();
    const month = d.getMonth(); // 0 = Jan, 3 = April, 11 = Dec
    if (month >= 3) {
        return {
            full: `${year}-${year + 1}`,
            short: `${year}-${String(year + 1).slice(-2)}`
        };
    } else {
        return {
            full: `${year - 1}-${year}`,
            short: `${year - 1}-${String(year).slice(-2)}`
        };
    }
};

/**
 * Create a new donation record (Only ADMIN)
 */
const addDonation = async (data, currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only ADMIN users can record donations.');
        error.statusCode = 403;
        throw error;
    }

    const {
        user_id,
        type,
        amount,
        remarks,
        whatsapp_send,
        date,
        donor_name,
        donor_mobile,
        donor_email,
        donor_address,
        upi_ref_no,
        cheque_no,
        bank_name
    } = data;

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

    if (type === 'UPI' && (!upi_ref_no || !upi_ref_no.trim())) {
        const error = new Error('UPI Reference Number is required for UPI donations.');
        error.statusCode = 400;
        throw error;
    }

    if (type === 'Cheque' && (!cheque_no || !cheque_no.trim())) {
        const error = new Error('Cheque Number is required for Cheque donations.');
        error.statusCode = 400;
        throw error;
    }

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        const error = new Error('Amount must be a positive number.');
        error.statusCode = 400;
        throw error;
    }
    if (parsedAmount > 9999999999) {
        const error = new Error('Amount cannot exceed ₹9,99,99,99,999.');
        error.statusCode = 400;
        throw error;
    }

    // Verify user exists and get their user details
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

    // Determine Financial Year
    const fy = getFinancialYear(parsedDate);
    const counterId = `donation_${fy.full}`;

    // Atomically increment the sequence counter for this financial year
    const counterDoc = await commonDao.findOneAndUpdate(
        {
            filter: { _id: counterId },
            update: { $inc: { seq: 1 } },
            options: { upsert: true, returnDocument: 'after' }
        },
        'counters'
    );

    const seq = (counterDoc && counterDoc.seq !== undefined)
        ? counterDoc.seq
        : (counterDoc && counterDoc.value ? counterDoc.value.seq : 1);

    const receiptNumber = `${fy.short}/${seq}`;

    // Generate amount in words
    const amountInWordsEn = toEnglishWords(parsedAmount);
    const amountInWordsTa = toTamilWords(parsedAmount);

    const payload = {
        user_id: user.user_id || user_id.trim(),
        username: user.username,
        donor_name: (donor_name && donor_name.trim()) || user.username,
        donor_mobile: (donor_mobile && donor_mobile.trim()) || user.mobile_number || null,
        donor_email: (donor_email && donor_email.trim()) || user.email || null,
        donor_address: (donor_address && donor_address.trim()) || user.address || null,
        type: type.trim(),
        upi_ref_no: type === 'UPI' ? (upi_ref_no ? upi_ref_no.trim() : null) : null,
        cheque_no: type === 'Cheque' ? (cheque_no ? cheque_no.trim() : null) : null,
        bank_name: type === 'Cheque' ? (bank_name ? bank_name.trim() : null) : null,
        amount: parsedAmount,
        amount_in_words: amountInWordsEn,
        amount_in_words_ta: amountInWordsTa,
        financial_year: fy.full,
        receipt_no: seq,
        receipt_number: receiptNumber,
        remarks: remarks && remarks.trim() ? remarks.trim() : null,
        whatsapp_send: whatsapp_send === true || whatsapp_send === 'true' ? true : false,
        date: parsedDate
    };

    try {
        const created = await commonDao.insertOne(payload, SCHEMA_NAME);
        logger.info(`Donation created: ${created.receipt_number} (_id: ${created._id}) for user ${user.username} (${user.user_id})`);
        return created;
    } catch (err) {
        if (err.code === 11000) {
            const duplicateError = new Error(`Receipt number duplicate collision for FY ${fy.full}. Please retry.`);
            duplicateError.statusCode = 409;
            throw duplicateError;
        }
        throw err;
    }
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
                { receipt_number: searchRegex },
                { user_id: searchRegex },
                { username: searchRegex },
                { donor_name: searchRegex },
                { donor_mobile: searchRegex },
                { donor_email: searchRegex },
                { upi_ref_no: searchRegex },
                { cheque_no: searchRegex },
                { bank_name: searchRegex },
                { type: searchRegex },
                { remarks: searchRegex }
            ]
        });
    }

    if (params.type && ['UPI', 'Cash', 'Cheque'].includes(params.type)) {
        conditions.push({ type: params.type });
    }

    if (params.financial_year && typeof params.financial_year === 'string' && params.financial_year.trim()) {
        conditions.push({ financial_year: params.financial_year.trim() });
    }

    const query = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

    const hasPagination = params.page !== undefined || params.limit !== undefined;
    const isAll = !hasPagination || params.all === 'true' || params.all === true || params.limit === 'all';

    if (isAll) {
        const data = await commonDao.findAll(
            { query, options: { sort: { date: -1, receipt_no: -1, createdAt: -1 } } },
            SCHEMA_NAME
        );
        return {
            data,
            pagination: {
                total: data.length,
                page: 1,
                limit: data.length,
                totalPages: 1
            }
        };
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(5000, Number(params.limit) || 10));

    return await commonDao.findWithPagination(
        { query, page, limit, sort: { date: -1, receipt_no: -1, createdAt: -1 } },
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
        if (data.type === 'UPI') {
            payload.cheque_no = null;
            payload.bank_name = null;
        } else if (data.type === 'Cheque') {
            payload.upi_ref_no = null;
        } else if (data.type === 'Cash') {
            payload.upi_ref_no = null;
            payload.cheque_no = null;
            payload.bank_name = null;
        }
    }

    if (data.upi_ref_no !== undefined) {
        payload.upi_ref_no = data.upi_ref_no && data.upi_ref_no.trim() ? data.upi_ref_no.trim() : null;
    }
    if (data.cheque_no !== undefined) {
        payload.cheque_no = data.cheque_no && data.cheque_no.trim() ? data.cheque_no.trim() : null;
    }
    if (data.bank_name !== undefined) {
        payload.bank_name = data.bank_name && data.bank_name.trim() ? data.bank_name.trim() : null;
    }
    if (data.donor_name !== undefined) {
        payload.donor_name = data.donor_name && data.donor_name.trim() ? data.donor_name.trim() : null;
    }
    if (data.donor_mobile !== undefined) {
        payload.donor_mobile = data.donor_mobile && data.donor_mobile.trim() ? data.donor_mobile.trim() : null;
    }
    if (data.donor_address !== undefined) {
        payload.donor_address = data.donor_address && data.donor_address.trim() ? data.donor_address.trim() : null;
    }
    if (data.remarks !== undefined) {
        payload.remarks = data.remarks && data.remarks.trim() ? data.remarks.trim() : null;
    }
    if (data.amount !== undefined) {
        const parsedAmount = Number(data.amount);
        if (!data.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            const error = new Error('Amount must be a positive number.');
            error.statusCode = 400;
            throw error;
        }
        if (parsedAmount > 9999999999) {
            const error = new Error('Amount cannot exceed ₹999,99,99,999 (10 digits).');
            error.statusCode = 400;
            throw error;
        }
        payload.amount = parsedAmount;
        payload.amount_in_words = toEnglishWords(parsedAmount);
        payload.amount_in_words_ta = toTamilWords(parsedAmount);
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
