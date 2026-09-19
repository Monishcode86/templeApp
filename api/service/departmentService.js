const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'departments';

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
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return h * 3600 + m * 60 + s;
};

/**
 * Format seconds into a readable string e.g. "8h", "12h", "2h 30m"
 */
const formatDuration = (sec) => {
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
 * Calculate duration between two HH:mm:ss timestamps
 */
const calculateDuration = (start, end) => {
    const startSec = toSeconds(start);
    let endSec = toSeconds(end);
    if (endSec <= startSec) endSec += 86400;
    return formatDuration(endSec - startSec);
};

/**
 * Add a new department
 */
const addDepartment = async (deptData) => {
    const { department_name, plant_id, plant_name, is_shift } = deptData;

    if (!department_name || !department_name.trim()) {
        const error = new Error('Department name is required.');
        error.statusCode = 400;
        throw error;
    }
    if (!plant_id || !plant_name) {
        const error = new Error('Plant ID and plant name are required.');
        error.statusCode = 400;
        throw error;
    }

    const normalizedPlantId = plant_id.trim().toUpperCase();
    const trimmedDeptName = department_name.trim();

    // Check duplicate department name per plant
    const existing = await commonDao.findOneData(
        { query: { department_name: trimmedDeptName, plant_id: normalizedPlantId } },
        SCHEMA_NAME
    );
    if (existing) {
        const error = new Error(`Department '${trimmedDeptName}' already exists in plant '${normalizedPlantId}'.`);
        error.statusCode = 409;
        throw error;
    }

    const usePlantShifts = is_shift !== false && is_shift !== 'false';
    let shiftData = [];

    if (usePlantShifts) {
        // Inherit & store respective plant's configured shifts
        const plantShifts = await commonDao.findAll(
            { query: { plant_id: normalizedPlantId }, options: { sort: { shift_id: 1 } } },
            'shifts'
        );
        shiftData = plantShifts.map((s, idx) => ({
            shift_id: s.shift_id || (idx + 1),
            shift_name: s.shift_name,
            start_time: s.start_time,
            end_time: s.end_time,
            duration: calculateDuration(s.start_time, s.end_time)
        }));
    } else {
        // Validate custom department shift configuration (must equal exactly 24 hours)
        const customShifts = Array.isArray(deptData.shift_data) ? deptData.shift_data : [];
        if (customShifts.length === 0) {
            const error = new Error('Please configure at least one shift for the department (24 hours total required).');
            error.statusCode = 400;
            throw error;
        }

        let totalSeconds = 0;
        shiftData = customShifts.map((s, idx) => {
            if (!s.shift_name || !s.shift_name.trim()) {
                const error = new Error(`Shift #${idx + 1} name is required.`);
                error.statusCode = 400;
                throw error;
            }
            if (!s.start_time || !s.end_time) {
                const error = new Error(`Start time and end time are required for shift '${s.shift_name}'.`);
                error.statusCode = 400;
                throw error;
            }

            const normStart = normalizeTime(s.start_time);
            const normEnd = normalizeTime(s.end_time);
            const startSec = toSeconds(normStart);
            let endSec = toSeconds(normEnd);
            if (endSec <= startSec) endSec += 86400;

            const durationSec = endSec - startSec;
            totalSeconds += durationSec;

            return {
                shift_id: idx + 1,
                shift_name: s.shift_name.trim(),
                start_time: normStart,
                end_time: normEnd,
                duration: formatDuration(durationSec)
            };
        });

        // Verify total duration equals exactly 24 hours (86,400 seconds)
        if (totalSeconds !== 86400) {
            const error = new Error(
                `Custom department shifts must total exactly 24 hours. ` +
                `Currently configured: ${formatDuration(totalSeconds)} (${Math.round((totalSeconds / 86400) * 100)}%).`
            );
            error.statusCode = 400;
            throw error;
        }
    }

    const payload = {
        department_name: trimmedDeptName,
        plant_id: normalizedPlantId,
        plant_name: plant_name.trim(),
        is_shift: usePlantShifts,
        shift_data: shiftData
    };

    const created = await commonDao.insertOne(payload, SCHEMA_NAME);
    logger.info(`New department created: ${created.department_name} (ID: ${created.department_id}) for plant ${created.plant_id}`);
    return created;
};

/**
 * Get all departments (supports search, plant filter & pagination)
 */
const getAllDepartments = async (params = {}) => {
    const query = {};

    if (params.plant_id) {
        query.plant_id = params.plant_id.trim().toUpperCase();
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { department_id: searchRegex },
            { department_name: searchRegex },
            { plant_id: searchRegex },
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

    const departments = await commonDao.findAll(
        { query, options: { sort: { createdAt: -1 } } },
        SCHEMA_NAME
    );
    return { data: departments };
};

/**
 * Get department by MongoDB _id
 */
const getDepartment = async (id) => {
    const dept = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!dept) {
        const error = new Error('Department not found.');
        error.statusCode = 404;
        throw error;
    }
    return dept;
};

/**
 * Update department
 */
const updateDepartment = async (updateData, id) => {
    const dept = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!dept) {
        const error = new Error('Department not found.');
        error.statusCode = 404;
        throw error;
    }

    const payload = {};

    if (updateData.department_name && updateData.department_name.trim()) {
        const trimmedName = updateData.department_name.trim();
        if (trimmedName !== dept.department_name) {
            const existing = await commonDao.findOneData(
                { query: { department_name: trimmedName, plant_id: dept.plant_id, _id: { $ne: dept._id } } },
                SCHEMA_NAME
            );
            if (existing) {
                const error = new Error(`Department '${trimmedName}' already exists in plant '${dept.plant_id}'.`);
                error.statusCode = 409;
                throw error;
            }
            payload.department_name = trimmedName;
        }
    }

    // If is_shift is explicitly toggled or shift_data updated
    if (updateData.is_shift !== undefined) {
        const usePlantShifts = updateData.is_shift === true || updateData.is_shift === 'true';
        payload.is_shift = usePlantShifts;

        if (usePlantShifts) {
            const plantShifts = await commonDao.findAll(
                { query: { plant_id: dept.plant_id }, options: { sort: { shift_id: 1 } } },
                'shifts'
            );
            payload.shift_data = plantShifts.map((s, idx) => ({
                shift_id: s.shift_id || (idx + 1),
                shift_name: s.shift_name,
                start_time: s.start_time,
                end_time: s.end_time,
                duration: calculateDuration(s.start_time, s.end_time)
            }));
        } else if (Array.isArray(updateData.shift_data) && updateData.shift_data.length > 0) {
            let totalSeconds = 0;
            payload.shift_data = updateData.shift_data.map((s, idx) => {
                const normStart = normalizeTime(s.start_time);
                const normEnd = normalizeTime(s.end_time);
                const startSec = toSeconds(normStart);
                let endSec = toSeconds(normEnd);
                if (endSec <= startSec) endSec += 86400;

                const durationSec = endSec - startSec;
                totalSeconds += durationSec;

                return {
                    shift_id: idx + 1,
                    shift_name: s.shift_name.trim(),
                    start_time: normStart,
                    end_time: normEnd,
                    duration: formatDuration(durationSec)
                };
            });

            if (totalSeconds !== 86400) {
                const error = new Error(
                    `Custom department shifts must total exactly 24 hours. ` +
                    `Currently configured: ${formatDuration(totalSeconds)} (${Math.round((totalSeconds / 86400) * 100)}%).`
                );
                error.statusCode = 400;
                throw error;
            }
        }
    }

    await commonDao.updateOne(
        { filter: { _id: dept._id }, update: { $set: payload } },
        SCHEMA_NAME
    );

    logger.info(`Department updated: ${dept._id}`);
    return await commonDao.findOneData({ query: { _id: dept._id } }, SCHEMA_NAME);
};

/**
 * Delete department
 */
const deleteDepartment = async (id) => {
    const dept = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!dept) {
        const error = new Error('Department not found.');
        error.statusCode = 404;
        throw error;
    }

    await commonDao.deleteOne({ _id: dept._id }, SCHEMA_NAME);
    logger.info(`Department deleted: ${dept._id}`);
    return { message: 'Department deleted successfully', id: dept._id };
};

module.exports = {
    addDepartment,
    getAllDepartments,
    getDepartment,
    updateDepartment,
    deleteDepartment
};
