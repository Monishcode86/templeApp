const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'machines';
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Add a new machine configuration
 */
const addMachine = async (machineData) => {
    const {
        plant_id,
        plant_name,
        department_id,
        department_name,
        machinetype,
        machinetype_id,
        machine_ip,
        machine_liscence
    } = machineData;

    if (!plant_id || !plant_id.trim()) {
        const error = new Error('Plant ID is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!plant_name || !plant_name.trim()) {
        const error = new Error('Plant name is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!department_id || !department_id.trim()) {
        const error = new Error('Department ID is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!department_name || !department_name.trim()) {
        const error = new Error('Department name is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!machinetype || !machinetype.trim()) {
        const error = new Error('Machine type is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!machine_ip || !machine_ip.trim()) {
        const error = new Error('Machine IP is required.');
        error.statusCode = 400;
        throw error;
    }

    const trimmedIp = machine_ip.trim();
    if (!IPV4_REGEX.test(trimmedIp)) {
        const error = new Error('Invalid IP address format. Please enter a valid IPv4 address (e.g. 192.55.55.5).');
        error.statusCode = 400;
        throw error;
    }

    if (machine_liscence === undefined || machine_liscence === null || machine_liscence === '') {
        const error = new Error('Machine license date is required.');
        error.statusCode = 400;
        throw error;
    }

    let licenseTs = Number(machine_liscence);
    if (isNaN(licenseTs)) {
        const parsed = new Date(machine_liscence).getTime();
        if (!isNaN(parsed)) {
            licenseTs = parsed;
        }
    }

    if (!licenseTs || isNaN(licenseTs)) {
        const error = new Error('Please provide a valid machine license date.');
        error.statusCode = 400;
        throw error;
    }

    const normalizedPlantId = plant_id.trim().toUpperCase();
    const trimmedPlantName = plant_name.trim();
    const trimmedDeptId = department_id.trim();
    const trimmedDeptName = department_name.trim();
    const trimmedMachineType = machinetype.trim();
    const trimmedMachineTypeId = machinetype_id ? machinetype_id.trim() : '';

    // Check unique IP in plant
    const existingIp = await commonDao.findOneData(
        {
            query: {
                plant_id: normalizedPlantId,
                machine_ip: trimmedIp
            }
        },
        SCHEMA_NAME
    );

    if (existingIp) {
        const error = new Error(
            `Machine IP '${trimmedIp}' is already registered to machine '${existingIp.machine_id}' in plant '${trimmedPlantName}'.`
        );
        error.statusCode = 409;
        throw error;
    }

    const docToCreate = {
        plant_id: normalizedPlantId,
        plant_name: trimmedPlantName,
        department_id: trimmedDeptId,
        department_name: trimmedDeptName,
        machinetype: trimmedMachineType,
        machinetype_id: trimmedMachineTypeId,
        machine_ip: trimmedIp,
        machine_liscence: licenseTs
    };

    const newDoc = await commonDao.insertOne(docToCreate, SCHEMA_NAME);
    logger.info(`Machine created: ${newDoc.machine_id} in plant ${newDoc.plant_id}`);
    return newDoc;
};

/**
 * Get all machines with optional filtering, search, and pagination
 */
const getAllMachines = async (params = {}) => {
    const query = {};

    if (params.plant_id) {
        query.plant_id = params.plant_id.trim().toUpperCase();
    }

    if (params.department_id) {
        query.department_id = params.department_id.trim();
    }

    if (params.machinetype) {
        query.machinetype = params.machinetype.trim();
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { machine_id: searchRegex },
            { machinetype: searchRegex },
            { machine_ip: searchRegex },
            { department_name: searchRegex },
            { plant_name: searchRegex }
        ];
        const numSearch = Number(params.search.trim());
        if (!isNaN(numSearch) && numSearch > 0) {
            query.$or.push({ machine_liscence: numSearch });
        }
    }

    if (params.page || params.limit) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
        return await commonDao.findWithPagination(
            { query, page, limit, sort: { createdAt: -1 } },
            SCHEMA_NAME
        );
    }

    const list = await commonDao.findAll(
        { query, options: { sort: { createdAt: -1 } } },
        SCHEMA_NAME
    );
    return { data: list };
};

/**
 * Get single machine by ID
 */
const getMachineById = async (id) => {
    const doc = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!doc) {
        const error = new Error('Machine not found.');
        error.statusCode = 404;
        throw error;
    }
    return doc;
};

/**
 * Update an existing machine
 */
const updateMachine = async (id, updateData) => {
    const existing = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!existing) {
        const error = new Error('Machine not found.');
        error.statusCode = 404;
        throw error;
    }

    const updateFields = {};

    if (updateData.department_id && updateData.department_name) {
        updateFields.department_id = updateData.department_id.trim();
        updateFields.department_name = updateData.department_name.trim();
    }

    if (updateData.machinetype) {
        updateFields.machinetype = updateData.machinetype.trim();
    }

    if (updateData.machinetype_id !== undefined) {
        updateFields.machinetype_id = updateData.machinetype_id ? updateData.machinetype_id.trim() : '';
    }

    if (updateData.machine_ip && updateData.machine_ip.trim() !== existing.machine_ip) {
        const trimmedIp = updateData.machine_ip.trim();
        if (!IPV4_REGEX.test(trimmedIp)) {
            const error = new Error('Invalid IP address format. Please enter a valid IPv4 address (e.g. 192.55.55.5).');
            error.statusCode = 400;
            throw error;
        }
        const duplicateIp = await commonDao.findOneData(
            {
                query: {
                    _id: { $ne: id },
                    plant_id: existing.plant_id,
                    machine_ip: trimmedIp
                }
            },
            SCHEMA_NAME
        );

        if (duplicateIp) {
            const error = new Error(
                `Machine IP '${trimmedIp}' is already registered to machine '${duplicateIp.machine_id}' in plant '${existing.plant_name}'.`
            );
            error.statusCode = 409;
            throw error;
        }
        updateFields.machine_ip = trimmedIp;
    }

    if (updateData.machine_liscence !== undefined && updateData.machine_liscence !== null && updateData.machine_liscence !== '') {
        let licenseTs = Number(updateData.machine_liscence);
        if (isNaN(licenseTs)) {
            const parsed = new Date(updateData.machine_liscence).getTime();
            if (!isNaN(parsed)) {
                licenseTs = parsed;
            }
        }
        if (!licenseTs || isNaN(licenseTs)) {
            const error = new Error('Please provide a valid machine license date.');
            error.statusCode = 400;
            throw error;
        }
        updateFields.machine_liscence = licenseTs;
    }

    await commonDao.updateOne(
        {
            filter: { _id: id },
            update: { $set: updateFields }
        },
        SCHEMA_NAME
    );

    const updated = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    logger.info(`Machine updated: ${updated.machine_id}`);
    return updated;
};

/**
 * Delete machine
 */
const deleteMachine = async (id) => {
    const existing = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!existing) {
        const error = new Error('Machine not found.');
        error.statusCode = 404;
        throw error;
    }

    await commonDao.deleteOne({ _id: id }, SCHEMA_NAME);
    logger.info(`Machine deleted: ${existing.machine_id} (${existing.plant_id})`);
    return { success: true, message: `Machine '${existing.machine_id}' deleted successfully.` };
};

module.exports = {
    addMachine,
    getAllMachines,
    getMachineById,
    updateMachine,
    deleteMachine
};
