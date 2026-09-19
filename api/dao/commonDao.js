const schema = require('../dto/index');

/**
 * Insert a single document into the specified schema
 */
exports.insertOne = async (data, schemaName) => {
    const collectionName = schema[schemaName];
    if (!collectionName) {
        throw new Error(`Schema '${schemaName}' not found in DTO registry.`);
    }
    return await collectionName.create(data);
};

/**
 * Insert multiple documents into the specified schema
 */
exports.addDataByMany = async (data, schemaName) => {
    const collectionName = schema[schemaName];
    if (!collectionName) {
        throw new Error(`Schema '${schemaName}' not found in DTO registry.`);
    }
    return await collectionName.insertMany(data);
};

/**
 * Find all matching documents, or count documents (Mongoose 9 compatible)
 */
exports.findAll = async (searchFields = {}, schemaName, id, count) => {
    const collectionName = id ? schema[schemaName](id) : schema[schemaName];
    if (!collectionName) {
        return [];
    }

    const query = searchFields.query || {};
    const fields = searchFields.fields || null;
    const options = searchFields.options || {};

    if (count === 'count') {
        return await collectionName.countDocuments(query);
    } else {
        return await collectionName.find(query, fields, options);
    }
};

/**
 * Common pagination helper for any schema
 */
exports.findWithPagination = async (searchFields = {}, schemaName, id) => {
    const page = Math.max(1, Number(searchFields.page) || 1);
    const limit = Math.max(1, Number(searchFields.limit) || 10);
    const skip = (page - 1) * limit;

    const query = searchFields.query || {};
    const fields = searchFields.fields || null;
    const sort = searchFields.sort || { createdAt: -1 };

    const total = await exports.findAll({ query }, schemaName, id, 'count');
    const data = await exports.findAll({ query, fields, options: { skip, limit, sort } }, schemaName, id);

    return {
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        }
    };
};

/**
 * Find a single document matching search criteria
 */
exports.findOneData = async (searchFields = {}, schemaName, id) => {
    const collectionName = id ? schema[schemaName](id) : schema[schemaName];
    if (!collectionName) {
        return null;
    }

    const query = searchFields.query || {};
    const fields = searchFields.fields || null;
    const options = searchFields.options || {};

    return await collectionName.findOne(query, fields, options);
};

/**
 * Update a single document
 */
exports.updateOne = async (data, schemaName) => {
    const collectionName = schema[schemaName];
    if (!collectionName) {
        throw new Error(`Schema '${schemaName}' not found in DTO registry.`);
    }
    return await collectionName.updateOne(data.filter, data.update, data.options || {});
};

/**
 * Update multiple documents
 */
exports.updateMany = async (data, schemaName) => {
    const collectionName = schema[schemaName];
    if (!collectionName) {
        throw new Error(`Schema '${schemaName}' not found in DTO registry.`);
    }
    return await collectionName.updateMany(data.filter, data.update, data.options || {});
};

/**
 * Delete a single document
 */
exports.deleteOne = async (data, schemaName) => {
    const collectionName = schema[schemaName];
    if (!collectionName) {
        throw new Error(`Schema '${schemaName}' not found in DTO registry.`);
    }
    return await collectionName.deleteOne(data);
};

/**
 * Delete multiple documents
 */
exports.deleteMany = async (data, schemaName) => {
    const collectionName = schema[schemaName];
    if (!collectionName) {
        throw new Error(`Schema '${schemaName}' not found in DTO registry.`);
    }
    return await collectionName.deleteMany(data);
};
