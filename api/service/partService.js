const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'parts';

/**
 * Validate and sanitize single operation entry
 */
const validateOperation = (op, seenNames) => {
    if (!op.operation_name || !op.operation_name.trim()) {
        const error = new Error('Operation name / ID is required for each operation.');
        error.statusCode = 400;
        throw error;
    }

    const trimmedName = op.operation_name.trim();
    if (seenNames.has(trimmedName.toLowerCase())) {
        const error = new Error(`Duplicate operation name '${trimmedName}' in operations list. Each operation name must be unique.`);
        error.statusCode = 400;
        throw error;
    }
    seenNames.add(trimmedName.toLowerCase());

    const run_time = Number(op.run_time) || 0;
    const load_time = Number(op.load_time) || 0;
    const unload_time = Number(op.unload_time) || 0;
    const count = Math.max(1, Number(op.count) || 1);
    const cycle_type = op.cycle_type === 'unit_per_parts' ? 'unit_per_parts' : 'part_per_cycle';

    if (run_time < 0 || load_time < 0 || unload_time < 0) {
        const error = new Error('Run time, load time, and unload time must be non-negative numbers.');
        error.statusCode = 400;
        throw error;
    }

    return {
        operation_name: trimmedName,
        run_time,
        load_time,
        unload_time,
        cycle_type,
        count
    };
};

/**
 * Add a new part
 */
const addPart = async (partData) => {
    const {
        program_number,
        part_name,
        plant_id,
        plant_name,
        has_operation,
        run_time,
        load_time,
        unload_time,
        cycle_type,
        count,
        operations
    } = partData;

    if (!program_number || !program_number.toString().trim()) {
        const error = new Error('Program number is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!part_name || !part_name.trim()) {
        const error = new Error('Part name is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!plant_id || !plant_name) {
        const error = new Error('Plant ID and plant name are required.');
        error.statusCode = 400;
        throw error;
    }

    const trimmedProgNo = program_number.toString().trim();
    const trimmedPartName = part_name.trim();
    const normalizedPlantId = plant_id.trim().toUpperCase();

    // Check unique program number
    const existingProg = await commonDao.findOneData(
        { query: { program_number: trimmedProgNo } },
        SCHEMA_NAME
    );
    if (existingProg) {
        const error = new Error(`Program number '${trimmedProgNo}' is already registered for part '${existingProg.part_name}'.`);
        error.statusCode = 409;
        throw error;
    }

    // Check duplicate part name per plant
    const existingName = await commonDao.findOneData(
        { query: { part_name: trimmedPartName, plant_id: normalizedPlantId } },
        SCHEMA_NAME
    );
    if (existingName) {
        const error = new Error(`Part '${trimmedPartName}' already exists in plant '${normalizedPlantId}'.`);
        error.statusCode = 409;
        throw error;
    }

    const isMultiOp = has_operation === true || has_operation === 'true';
    let validatedOperations = [];
    let validatedRunTime = 0;
    let validatedLoadTime = 0;
    let validatedUnloadTime = 0;
    let validatedCycleType = 'part_per_cycle';
    let validatedCount = 1;

    if (isMultiOp) {
        if (!Array.isArray(operations) || operations.length === 0) {
            const error = new Error('At least one operation must be configured when multi-operation mode is enabled.');
            error.statusCode = 400;
            throw error;
        }

        const seenNames = new Set();
        validatedOperations = operations.map(op => validateOperation(op, seenNames));
    } else {
        validatedRunTime = Math.max(0, Number(run_time) || 0);
        validatedLoadTime = Math.max(0, Number(load_time) || 0);
        validatedUnloadTime = Math.max(0, Number(unload_time) || 0);
        validatedCycleType = cycle_type === 'unit_per_parts' ? 'unit_per_parts' : 'part_per_cycle';
        validatedCount = Math.max(1, Number(count) || 1);
    }

    const payload = {
        program_number: trimmedProgNo,
        part_name: trimmedPartName,
        plant_id: normalizedPlantId,
        plant_name: plant_name.trim(),
        has_operation: isMultiOp,
        run_time: validatedRunTime,
        load_time: validatedLoadTime,
        unload_time: validatedUnloadTime,
        cycle_type: validatedCycleType,
        count: validatedCount,
        operations: validatedOperations
    };

    const created = await commonDao.insertOne(payload, SCHEMA_NAME);
    logger.info(`New Part created: ${created.part_name} (${created.part_id}) for plant ${created.plant_id}`);
    return created;
};

/**
 * Get all parts with filtering, search, and pagination
 */
const getAllParts = async (params = {}) => {
    const query = {};

    if (params.plant_id) {
        query.plant_id = params.plant_id.trim().toUpperCase();
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { part_id: searchRegex },
            { program_number: searchRegex },
            { part_name: searchRegex },
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

    const parts = await commonDao.findAll(
        { query, options: { sort: { createdAt: -1 } } },
        SCHEMA_NAME
    );
    return { data: parts };
};

/**
 * Get part by MongoDB _id
 */
const getPart = async (id) => {
    const part = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!part) {
        const error = new Error('Part not found.');
        error.statusCode = 404;
        throw error;
    }
    return part;
};

/**
 * Update an existing part
 */
const updatePart = async (updateData, id) => {
    const part = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!part) {
        const error = new Error('Part not found.');
        error.statusCode = 404;
        throw error;
    }

    const payload = {};

    // Program number uniqueness
    if (updateData.program_number !== undefined) {
        const trimmedProg = updateData.program_number.toString().trim();
        if (!trimmedProg) {
            const error = new Error('Program number cannot be empty.');
            error.statusCode = 400;
            throw error;
        }

        const duplicateProg = await commonDao.findOneData(
            { query: { program_number: trimmedProg, _id: { $ne: part._id } } },
            SCHEMA_NAME
        );
        if (duplicateProg) {
            const error = new Error(`Program number '${trimmedProg}' is already assigned to another part.`);
            error.statusCode = 409;
            throw error;
        }
        payload.program_number = trimmedProg;
    }

    // Part name uniqueness per plant
    if (updateData.part_name !== undefined) {
        const trimmedName = updateData.part_name.trim();
        if (!trimmedName) {
            const error = new Error('Part name cannot be empty.');
            error.statusCode = 400;
            throw error;
        }

        const plantToCheck = updateData.plant_id ? updateData.plant_id.trim().toUpperCase() : part.plant_id;
        const duplicateName = await commonDao.findOneData(
            { query: { part_name: trimmedName, plant_id: plantToCheck, _id: { $ne: part._id } } },
            SCHEMA_NAME
        );
        if (duplicateName) {
            const error = new Error(`Part '${trimmedName}' already exists in plant '${plantToCheck}'.`);
            error.statusCode = 409;
            throw error;
        }
        payload.part_name = trimmedName;
    }

    if (updateData.plant_name) payload.plant_name = updateData.plant_name.trim();

    if (updateData.has_operation !== undefined) {
        payload.has_operation = updateData.has_operation === true || updateData.has_operation === 'true';
    }

    const isMulti = payload.has_operation !== undefined ? payload.has_operation : part.has_operation;

    if (isMulti) {
        if (Array.isArray(updateData.operations)) {
            if (updateData.operations.length === 0) {
                const error = new Error('At least one operation must be configured when multi-operation mode is enabled.');
                error.statusCode = 400;
                throw error;
            }
            const seen = new Set();
            payload.operations = updateData.operations.map(op => validateOperation(op, seen));
        }
    } else {
        if (updateData.run_time !== undefined) payload.run_time = Math.max(0, Number(updateData.run_time) || 0);
        if (updateData.load_time !== undefined) payload.load_time = Math.max(0, Number(updateData.load_time) || 0);
        if (updateData.unload_time !== undefined) payload.unload_time = Math.max(0, Number(updateData.unload_time) || 0);
        if (updateData.cycle_type !== undefined) {
            payload.cycle_type = updateData.cycle_type === 'unit_per_parts' ? 'unit_per_parts' : 'part_per_cycle';
        }
        if (updateData.count !== undefined) payload.count = Math.max(1, Number(updateData.count) || 1);
    }

    await commonDao.updateOne(
        { filter: { _id: part._id }, update: { $set: payload } },
        SCHEMA_NAME
    );

    logger.info(`Part updated: ${part._id}`);
    return await commonDao.findOneData({ query: { _id: part._id } }, SCHEMA_NAME);
};

/**
 * Delete part by _id
 */
const deletePart = async (id) => {
    const part = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!part) {
        const error = new Error('Part not found.');
        error.statusCode = 404;
        throw error;
    }

    await commonDao.deleteOne({ _id: part._id }, SCHEMA_NAME);
    logger.info(`Part deleted: ${part._id}`);
    return { message: 'Part deleted successfully', id: part._id };
};

module.exports = {
    addPart,
    getAllParts,
    getParts: getAllParts,
    getPart,
    updatePart,
    deletePart
};
