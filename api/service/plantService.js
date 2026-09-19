const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'plants';

/**
 * Add a new plant
 */
const addPlant = async (plantData) => {
    const { plant_id, plant_name, location, plant_img, pincode, no_of_employee } = plantData;

    if (!plant_id || !plant_name || !location || !pincode) {
        const error = new Error('Plant ID, plant name, location, and pincode are required.');
        error.statusCode = 400;
        throw error;
    }

    // Check if plant_id already exists
    const existing = await commonDao.findOneData(
        { query: { plant_id: plant_id.trim().toUpperCase() } },
        SCHEMA_NAME
    );
    if (existing) {
        const error = new Error(`Plant with ID '${plant_id}' already exists.`);
        error.statusCode = 409;
        throw error;
    }

    const payload = {
        plant_id: plant_id.trim().toUpperCase(),
        plant_name: plant_name.trim(),
        location: location.trim(),
        plant_img: plant_img ? plant_img.trim() : null,
        pincode: pincode.trim(),
        no_of_employee: Number(no_of_employee) || 0
    };

    const createdPlant = await commonDao.insertOne(payload, SCHEMA_NAME);
    logger.info(`New plant created: ${createdPlant.plant_name} (${createdPlant.plant_id})`);
    return createdPlant;
};

/**
 * Get all plants (supports search & optional pagination)
 */
const getAllPlants = async (params = {}) => {
    const query = {};

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        query.$or = [
            { plant_id: searchRegex },
            { plant_name: searchRegex },
            { location: searchRegex },
            { pincode: searchRegex }
        ];
    }

    if (params.page || params.limit) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
        return await commonDao.findWithPagination(
            {
                query,
                page,
                limit,
                sort: { createdAt: -1 }
            },
            SCHEMA_NAME
        );
    }

    // Default: return all plants sorted by plant_name
    const plants = await commonDao.findAll(
        { query, options: { sort: { plant_name: 1 } } },
        SCHEMA_NAME
    );
    return { data: plants };
};

/**
 * Get plant by ID (MongoDB _id or plant_id)
 */
const getPlant = async (id) => {
    let plant = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!plant) {
        plant = await commonDao.findOneData({ query: { plant_id: id.toUpperCase() } }, SCHEMA_NAME);
    }

    if (!plant) {
        const error = new Error(`Plant with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    return plant;
};

const fs = require('fs');
const path = require('path');

const deleteLocalImageFile = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    try {
        if (imageUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', imageUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`Cleaned up plant image file: ${filePath}`);
            }
        }
    } catch (err) {
        logger.warn(`Failed to clean up plant image file: ${err.message}`);
    }
};

/**
 * Update plant
 */
const updatePlant = async (updateData, id) => {
    let plant = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!plant) {
        plant = await commonDao.findOneData({ query: { plant_id: id.toUpperCase() } }, SCHEMA_NAME);
    }
    if (!plant) {
        const error = new Error(`Plant with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    const payload = { ...updateData };
    delete payload._id;
    delete payload.id;

    if (payload.plant_img !== undefined && payload.plant_img !== plant.plant_img) {
        deleteLocalImageFile(plant.plant_img);
    }

    if (payload.plant_id) {
        payload.plant_id = payload.plant_id.trim().toUpperCase();
        // Check uniqueness if plant_id changed
        const existing = await commonDao.findOneData(
            { query: { plant_id: payload.plant_id, _id: { $ne: plant._id } } },
            SCHEMA_NAME
        );
        if (existing) {
            const error = new Error(`Plant with ID '${payload.plant_id}' already exists.`);
            error.statusCode = 409;
            throw error;
        }
    }

    if (payload.no_of_employee !== undefined) {
        payload.no_of_employee = Number(payload.no_of_employee) || 0;
    }

    await commonDao.updateOne(
        { filter: { _id: plant._id }, update: { $set: payload } },
        SCHEMA_NAME
    );

    logger.info(`Plant updated: ${plant._id}`);
    return await commonDao.findOneData({ query: { _id: plant._id } }, SCHEMA_NAME);
};

/**
 * Delete plant
 */
const deletePlant = async (id) => {
    let plant = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!plant) {
        plant = await commonDao.findOneData({ query: { plant_id: id.toUpperCase() } }, SCHEMA_NAME);
    }
    if (!plant) {
        const error = new Error(`Plant with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    if (plant.plant_img) {
        deleteLocalImageFile(plant.plant_img);
    }

    await commonDao.deleteOne({ _id: plant._id }, SCHEMA_NAME);
    logger.info(`Plant deleted: ${plant._id}`);
    return { message: 'Plant deleted successfully', id: plant._id };
};

module.exports = {
    addPlant,
    getAllPlants,
    getPlant,
    updatePlant,
    deletePlant
};
