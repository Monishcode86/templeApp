const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'downtimes';

/**
 * Validate and sanitize sub-reasons (optional)
 */
const sanitizeSubReasons = (subReasons, singleSubId, singleSubName) => {
    const list = Array.isArray(subReasons) ? [...subReasons] : [];

    // If sub_reasons array is empty but single subreason fields are provided, use them
    if (list.length === 0 && singleSubId && singleSubName) {
        list.push({
            subreason_id: singleSubId.trim(),
            sub_reason: singleSubName.trim()
        });
    }

    // Sub-reasons are optional: if list is empty, return empty array
    if (list.length === 0) {
        return [];
    }

    const seenIds = new Set();
    const sanitized = [];

    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const trimmedId = item.subreason_id ? item.subreason_id.trim() : '';
        const trimmedDesc = item.sub_reason ? item.sub_reason.trim() : '';

        // If both ID and description are empty, skip the row
        if (!trimmedId && !trimmedDesc) {
            continue;
        }

        if (!trimmedId) {
            const error = new Error(`Sub-reason #${i + 1} requires a valid subreason_id.`);
            error.statusCode = 400;
            throw error;
        }
        if (!trimmedDesc) {
            const error = new Error(`Sub-reason #${i + 1} requires a valid sub_reason description.`);
            error.statusCode = 400;
            throw error;
        }

        const lowerId = trimmedId.toLowerCase();
        if (seenIds.has(lowerId)) {
            const error = new Error(`Duplicate subreason_id '${trimmedId}'. Sub-reason IDs must be unique within the reason.`);
            error.statusCode = 400;
            throw error;
        }
        seenIds.add(lowerId);

        sanitized.push({
            subreason_id: trimmedId,
            sub_reason: trimmedDesc
        });
    }

    return sanitized;
};

/**
 * Add a new downtime / rejection reason
 */
const addDowntimeReason = async (reasonData) => {
    const {
        plant_id,
        plant_name,
        downtime_type,
        mainreason_id,
        main_reason,
        subreason_id,
        sub_reason,
        sub_reasons
    } = reasonData;

    if (!plant_id || !plant_name) {
        const error = new Error('Plant ID and plant name are required.');
        error.statusCode = 400;
        throw error;
    }

    if (!downtime_type || !['rejection', 'downtime'].includes(downtime_type.toLowerCase())) {
        const error = new Error("downtime_type must be either 'rejection' or 'downtime'.");
        error.statusCode = 400;
        throw error;
    }

    if (!mainreason_id || !mainreason_id.trim()) {
        const error = new Error('Main reason ID is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!main_reason || !main_reason.trim()) {
        const error = new Error('Main reason description is required.');
        error.statusCode = 400;
        throw error;
    }

    const normalizedPlantId = plant_id.trim().toUpperCase();
    const normalizedType = downtime_type.trim().toLowerCase();
    const trimmedMainReasonId = mainreason_id.trim();
    const trimmedMainReason = main_reason.trim();

    // Check unique mainreason_id per plant and downtime_type
    const existingMainReason = await commonDao.findOneData(
        {
            query: {
                plant_id: normalizedPlantId,
                downtime_type: normalizedType,
                mainreason_id: trimmedMainReasonId
            }
        },
        SCHEMA_NAME
    );

    if (existingMainReason) {
        const error = new Error(
            `Main reason ID '${trimmedMainReasonId}' is already registered for plant '${plant_name}' under ${normalizedType}.`
        );
        error.statusCode = 409;
        throw error;
    }

    const sanitizedSubs = sanitizeSubReasons(sub_reasons, subreason_id, sub_reason);

    const docToCreate = {
        plant_id: normalizedPlantId,
        plant_name: plant_name.trim(),
        downtime_type: normalizedType,
        mainreason_id: trimmedMainReasonId,
        main_reason: trimmedMainReason,
        subreason_id: sanitizedSubs.length > 0 ? sanitizedSubs[0].subreason_id : '',
        sub_reason: sanitizedSubs.length > 0 ? sanitizedSubs[0].sub_reason : '',
        sub_reasons: sanitizedSubs
    };

    const newDoc = await commonDao.insertOne(docToCreate, SCHEMA_NAME);
    logger.info(`Downtime reason created: ${newDoc.reason_id} (${newDoc.downtime_type}) for plant ${newDoc.plant_id}`);
    return newDoc;
};

/**
 * Get all downtime reasons with filtering, search, and pagination
 */
const getAllDowntimeReasons = async (params = {}) => {
    const query = {};

    if (params.plant_id) {
        query.plant_id = params.plant_id.trim().toUpperCase();
    }

    if (params.downtime_type && ['rejection', 'downtime'].includes(params.downtime_type.toLowerCase())) {
        query.downtime_type = params.downtime_type.trim().toLowerCase();
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { reason_id: searchRegex },
            { mainreason_id: searchRegex },
            { main_reason: searchRegex },
            { subreason_id: searchRegex },
            { sub_reason: searchRegex },
            { 'sub_reasons.subreason_id': searchRegex },
            { 'sub_reasons.sub_reason': searchRegex },
            { plant_name: searchRegex }
        ];
    }

    if (params.page || params.limit) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
        return await commonDao.findWithPagination(
            { query, page, limit, sort: { createdAt: -1 } },
            SCHEMA_NAME
        );
    }

    const reasons = await commonDao.findAll(
        { query, options: { sort: { createdAt: -1 } } },
        SCHEMA_NAME
    );
    return { data: reasons };
};

/**
 * Get single downtime reason by ID
 */
const getDowntimeReasonById = async (id) => {
    const doc = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!doc) {
        const error = new Error('Downtime reason not found.');
        error.statusCode = 404;
        throw error;
    }
    return doc;
};

/**
 * Update downtime reason
 */
const updateDowntimeReason = async (id, updateData) => {
    const existing = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!existing) {
        const error = new Error('Downtime reason not found.');
        error.statusCode = 404;
        throw error;
    }

    const updateFields = {};

    // Validate main reason ID if changed
    if (updateData.mainreason_id && updateData.mainreason_id.trim() !== existing.mainreason_id) {
        const trimmedMainId = updateData.mainreason_id.trim();
        const duplicate = await commonDao.findOneData(
            {
                query: {
                    _id: { $ne: id },
                    plant_id: existing.plant_id,
                    downtime_type: existing.downtime_type,
                    mainreason_id: trimmedMainId
                }
            },
            SCHEMA_NAME
        );

        if (duplicate) {
            const error = new Error(
                `Main reason ID '${trimmedMainId}' is already in use by another reason in plant '${existing.plant_name}'.`
            );
            error.statusCode = 409;
            throw error;
        }
        updateFields.mainreason_id = trimmedMainId;
    }

    if (updateData.main_reason && updateData.main_reason.trim()) {
        updateFields.main_reason = updateData.main_reason.trim();
    }

    // Sub-reasons update (optional)
    if (updateData.sub_reasons !== undefined || (updateData.subreason_id !== undefined && updateData.sub_reason !== undefined)) {
        const sanitizedSubs = sanitizeSubReasons(
            updateData.sub_reasons,
            updateData.subreason_id,
            updateData.sub_reason
        );
        updateFields.sub_reasons = sanitizedSubs;
        updateFields.subreason_id = sanitizedSubs.length > 0 ? sanitizedSubs[0].subreason_id : '';
        updateFields.sub_reason = sanitizedSubs.length > 0 ? sanitizedSubs[0].sub_reason : '';
    }

    await commonDao.updateOne(
        {
            filter: { _id: id },
            update: { $set: updateFields }
        },
        SCHEMA_NAME
    );

    logger.info(`Downtime reason updated: ${existing.reason_id}`);
    return await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
};

/**
 * Delete downtime reason
 */
const deleteDowntimeReason = async (id) => {
    const existing = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!existing) {
        const error = new Error('Downtime reason not found.');
        error.statusCode = 404;
        throw error;
    }

    await commonDao.deleteOne({ _id: id }, SCHEMA_NAME);
    logger.info(`Downtime reason deleted: ${existing.reason_id}`);
    return { message: 'Downtime reason deleted successfully', id };
};

module.exports = {
    addDowntimeReason,
    getAllDowntimeReasons,
    getDowntimeReasons: getAllDowntimeReasons,
    getDowntimeReasonById,
    updateDowntimeReason,
    deleteDowntimeReason
};
