const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'machinetypes';

/**
 * Add a new machine type configuration
 */
const addMachineType = async (typeData) => {
    const { plant_id, plant_name, machinetype, description } = typeData;

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

    if (!machinetype || !machinetype.trim()) {
        const error = new Error('Machine type name is required.');
        error.statusCode = 400;
        throw error;
    }

    const normalizedPlantId = plant_id.trim().toUpperCase();
    const trimmedPlantName = plant_name.trim();
    const trimmedMachineType = machinetype.trim();
    const trimmedDescription = description ? description.trim() : '';

    // Check if machine type already exists for this plant
    const existing = await commonDao.findOneData(
        {
            query: {
                plant_id: normalizedPlantId,
                machinetype: { $regex: new RegExp(`^${trimmedMachineType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            }
        },
        SCHEMA_NAME
    );

    if (existing) {
        const error = new Error(
            `Machine type '${trimmedMachineType}' is already configured for plant '${trimmedPlantName}'.`
        );
        error.statusCode = 409;
        throw error;
    }

    const docToCreate = {
        plant_id: normalizedPlantId,
        plant_name: trimmedPlantName,
        machinetype: trimmedMachineType,
        description: trimmedDescription
    };

    const newDoc = await commonDao.insertOne(docToCreate, SCHEMA_NAME);
    logger.info(`Machine type created: ${newDoc.machinetype_id} (${newDoc.machinetype}) for plant ${newDoc.plant_id}`);
    return newDoc;
};

/**
 * Get all machine types with optional filtering, search, and pagination
 */
const getAllMachineTypes = async (params = {}) => {
    const query = {};

    if (params.plant_id) {
        query.plant_id = params.plant_id.trim().toUpperCase();
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { machinetype_id: searchRegex },
            { machinetype: searchRegex },
            { description: searchRegex },
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

    const list = await commonDao.findAll(
        { query, options: { sort: { createdAt: -1 } } },
        SCHEMA_NAME
    );
    return { data: list };
};

/**
 * Get single machine type by ID
 */
const getMachineTypeById = async (id) => {
    const doc = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!doc) {
        const error = new Error('Machine type not found.');
        error.statusCode = 404;
        throw error;
    }
    return doc;
};

/**
 * Update an existing machine type
 */
const updateMachineType = async (id, updateData) => {
    const existing = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!existing) {
        const error = new Error('Machine type not found.');
        error.statusCode = 404;
        throw error;
    }

    const updateFields = {};

    if (updateData.machinetype && updateData.machinetype.trim()) {
        const trimmedType = updateData.machinetype.trim();
        if (trimmedType.toLowerCase() !== existing.machinetype.toLowerCase()) {
            const duplicate = await commonDao.findOneData(
                {
                    query: {
                        _id: { $ne: id },
                        plant_id: existing.plant_id,
                        machinetype: { $regex: new RegExp(`^${trimmedType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                    }
                },
                SCHEMA_NAME
            );

            if (duplicate) {
                const error = new Error(
                    `Machine type '${trimmedType}' is already configured for plant '${existing.plant_name}'.`
                );
                error.statusCode = 409;
                throw error;
            }
        }
        updateFields.machinetype = trimmedType;
    }

    if (updateData.description !== undefined) {
        updateFields.description = updateData.description.trim();
    }

    await commonDao.updateOne(
        {
            filter: { _id: id },
            update: { $set: updateFields }
        },
        SCHEMA_NAME
    );

    const updated = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    logger.info(`Machine type updated: ${updated.machinetype_id} (${updated.machinetype})`);
    return updated;
};

/**
 * Delete machine type
 */
const deleteMachineType = async (id) => {
    const existing = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!existing) {
        const error = new Error('Machine type not found.');
        error.statusCode = 404;
        throw error;
    }

    await commonDao.deleteOne({ _id: id }, SCHEMA_NAME);
    logger.info(`Machine type deleted: ${existing.machinetype_id} (${existing.machinetype})`);
    return { success: true, message: `Machine type '${existing.machinetype}' deleted successfully.` };
};

module.exports = {
    addMachineType,
    getAllMachineTypes,
    getMachineTypeById,
    updateMachineType,
    deleteMachineType
};
