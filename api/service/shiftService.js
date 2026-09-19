const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'shifts';

/**
 * Normalize time to HH:mm:ss
 */
const normalizeTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const parts = timeStr.trim().split(':');
    const h = (parts[0] || '00').padStart(2, '0');
    const m = (parts[1] || '00').padStart(2, '0');
    const s = (parts[2] || '00').padStart(2, '0');
    return `${h}:${m}:${s}`;
};

/**
 * Convert HH:mm:ss string to total seconds
 */
const toSeconds = (timeStr) => {
    const parts = timeStr.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return h * 3600 + m * 60 + s;
};

/**
 * Validate shift duration is <= 24 hours (86400 seconds)
 */
const validateDuration = (start_time, end_time) => {
    const startSec = toSeconds(start_time);
    let endSec = toSeconds(end_time);

    // Handle overnight shifts (end <= start means it crosses midnight)
    if (endSec <= startSec) {
        endSec += 86400;
    }

    const duration = endSec - startSec;
    if (duration > 86400) {
        const error = new Error('Shift duration cannot exceed 24 hours.');
        error.statusCode = 400;
        throw error;
    }
    if (duration === 0) {
        const error = new Error('Start time and end time cannot be the same.');
        error.statusCode = 400;
        throw error;
    }
    return duration;
};

/**
 * Calculate total seconds already allocated across all shifts for a plant
 */
const getTotalPlantSeconds = async (plantId, excludeId = null) => {
    const query = { plant_id: plantId.trim().toUpperCase() };
    if (excludeId) query._id = { $ne: excludeId };

    const shifts = await commonDao.findAll(
        { query, options: { sort: { shift_id: 1 } } },
        SCHEMA_NAME
    );

    return shifts.reduce((total, shift) => {
        const startSec = toSeconds(shift.start_time);
        let endSec = toSeconds(shift.end_time);
        if (endSec <= startSec) endSec += 86400;
        return total + (endSec - startSec);
    }, 0);
};

/**
 * Format seconds into a readable string e.g. "12h", "14h 30m", "14h 30m 15s"
 */
const formatSeconds = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.length > 0 ? parts.join(' ') : '0s';
};

/**
 * Add a new shift
 */
const addShift = async (shiftData) => {
    const { shift_name, plant_id, plant_name, start_time, end_time } = shiftData;

    if (!shift_name || !plant_id || !plant_name || !start_time || !end_time) {
        const error = new Error('Shift name, plant, start time, and end time are required.');
        error.statusCode = 400;
        throw error;
    }

    const normStart = normalizeTime(start_time);
    const normEnd = normalizeTime(end_time);

    const newDuration = validateDuration(normStart, normEnd);
    const normalizedPlantId = plant_id.trim().toUpperCase();

    // Check total seconds already allocated for this plant (24 hours = 86400 seconds)
    const totalAllocated = await getTotalPlantSeconds(normalizedPlantId);

    if (totalAllocated >= 86400) {
        const error = new Error(
            `All 24 hours are already configured for plant '${normalizedPlantId}'. No capacity remaining.`
        );
        error.statusCode = 400;
        throw error;
    }

    const remaining = 86400 - totalAllocated;
    if (newDuration > remaining) {
        const error = new Error(
            `This shift (${formatSeconds(newDuration)}) exceeds the remaining capacity. ` +
            `Only ${formatSeconds(remaining)} available for plant '${normalizedPlantId}'.`
        );
        error.statusCode = 400;
        throw error;
    }

    // Check duplicate shift name per plant
    const existing = await commonDao.findOneData(
        { query: { shift_name: shift_name.trim(), plant_id: normalizedPlantId } },
        SCHEMA_NAME
    );
    if (existing) {
        const error = new Error(`Shift '${shift_name}' already exists for this plant.`);
        error.statusCode = 409;
        throw error;
    }

    const payload = {
        shift_name: shift_name.trim(),
        plant_id: normalizedPlantId,
        plant_name: plant_name.trim(),
        start_time: normStart,
        end_time: normEnd
    };

    const created = await commonDao.insertOne(payload, SCHEMA_NAME);
    logger.info(`New shift created: ${created.shift_name} (ID: ${created.shift_id}) for plant ${created.plant_id}`);
    return created;
};

/**
 * Get all shifts (supports search, plant filter & pagination)
 */
const getAllShifts = async (params = {}) => {
    const query = {};

    if (params.plant_id) {
        query.plant_id = params.plant_id.trim().toUpperCase();
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { shift_name: searchRegex },
            { plant_id: searchRegex },
            { plant_name: searchRegex }
        ];
    }

    let result;
    if (params.page || params.limit) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
        result = await commonDao.findWithPagination(
            { query, page, limit, sort: { plant_id: 1, shift_id: 1 } },
            SCHEMA_NAME
        );
    } else {
        const shifts = await commonDao.findAll(
            { query, options: { sort: { plant_id: 1, shift_id: 1 } } },
            SCHEMA_NAME
        );
        result = { data: shifts };
    }

    // Determine `is_last` for each shift per plant
    if (result.data && result.data.length > 0) {
        const plantIds = [...new Set(result.data.map(s => s.plant_id))];
        const allPlantShifts = await commonDao.findAll(
            { query: { plant_id: { $in: plantIds } }, options: { sort: { shift_id: -1 } } },
            SCHEMA_NAME
        );
        const maxShiftMap = {};
        for (const s of allPlantShifts) {
            if (!maxShiftMap[s.plant_id] || s.shift_id > maxShiftMap[s.plant_id]) {
                maxShiftMap[s.plant_id] = s.shift_id;
            }
        }

        result.data = result.data.map(s => {
            const obj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
            obj.is_last = (obj.shift_id === maxShiftMap[obj.plant_id]);
            return obj;
        });
    }

    return result;
};

/**
 * Get shift by MongoDB _id
 */
const getShift = async (id) => {
    const shift = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!shift) {
        const error = new Error(`Shift not found.`);
        error.statusCode = 404;
        throw error;
    }
    return shift;
};

/**
 * Update shift - Only shift_name is editable
 */
const updateShift = async (updateData, id) => {
    const shift = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!shift) {
        const error = new Error(`Shift not found.`);
        error.statusCode = 404;
        throw error;
    }

    if (!updateData.shift_name || !updateData.shift_name.trim()) {
        const error = new Error('Shift name is required.');
        error.statusCode = 400;
        throw error;
    }

    const newShiftName = updateData.shift_name.trim();

    // Check if another shift with this name already exists for this plant
    if (newShiftName !== shift.shift_name) {
        const existing = await commonDao.findOneData(
            { query: { shift_name: newShiftName, plant_id: shift.plant_id, _id: { $ne: shift._id } } },
            SCHEMA_NAME
        );
        if (existing) {
            const error = new Error(`Shift '${newShiftName}' already exists for plant '${shift.plant_id}'.`);
            error.statusCode = 409;
            throw error;
        }
    }

    // Only update shift_name (timings, plant, and shift_id remain locked)
    await commonDao.updateOne(
        { filter: { _id: shift._id }, update: { $set: { shift_name: newShiftName } } },
        SCHEMA_NAME
    );

    logger.info(`Shift name updated: ${shift._id} ('${shift.shift_name}' -> '${newShiftName}')`);
    return await commonDao.findOneData({ query: { _id: shift._id } }, SCHEMA_NAME);
};

/**
 * Delete shift - Only allowed for the last shift of that plant (cannot delete in the middle)
 */
const deleteShift = async (id) => {
    const shift = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!shift) {
        const error = new Error(`Shift not found.`);
        error.statusCode = 404;
        throw error;
    }

    // Check if there is any subsequent shift for the same plant with higher shift_id
    const subsequentShift = await commonDao.findOneData(
        { query: { plant_id: shift.plant_id, shift_id: { $gt: shift.shift_id } } },
        SCHEMA_NAME
    );
    if (subsequentShift) {
        const error = new Error(
            `Cannot delete shift #${shift.shift_id} ('${shift.shift_name}'). ` +
            `Deleting shifts in the middle is not allowed. Only the last shift for plant '${shift.plant_id}' can be deleted.`
        );
        error.statusCode = 400;
        throw error;
    }

    await commonDao.deleteOne({ _id: shift._id }, SCHEMA_NAME);
    logger.info(`Shift deleted: ${shift._id}`);
    return { message: 'Shift deleted successfully', id: shift._id };
};

module.exports = {
    addShift,
    getAllShifts,
    getShift,
    updateShift,
    deleteShift
};
