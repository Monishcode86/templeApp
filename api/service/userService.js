const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'users';
const saltRounds = Number(process.env.HASH_ROUNDS || 10);

/**
 * Helper to safely delete an uploaded image from disk
 */
const deleteLocalImageFile = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    try {
        if (imageUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', imageUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`Cleaned up image file from disk: ${filePath}`);
            }
        }
    } catch (err) {
        logger.warn(`Failed to clean up image file: ${err.message}`);
    }
};

/**
 * Add a new user
 */
const adduser = async (userData) => {
    const { username, email, password, role, employee_id, image, plant_id, plant_name } = userData;

    if (!username || !email || !password) {
        const error = new Error('Username, email, and password are required.');
        error.statusCode = 400;
        throw error;
    }

    // Check for existing user with this email
    const existingEmail = await commonDao.findOneData({ query: { email: email.toLowerCase().trim() } }, SCHEMA_NAME);
    if (existingEmail) {
        const error = new Error(`User with email '${email}' already exists.`);
        error.statusCode = 409;
        throw error;
    }

    // Check for existing user with this employee_id if provided
    if (employee_id && typeof employee_id === 'string' && employee_id.trim()) {
        const existingEmp = await commonDao.findOneData(
            { query: { employee_id: employee_id.trim() } },
            SCHEMA_NAME
        );
        if (existingEmp) {
            const error = new Error(`User with Employee ID '${employee_id.trim()}' already exists.`);
            error.statusCode = 409;
            throw error;
        }
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUserPayload = {
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role || 'USER',
        employee_id: employee_id ? employee_id.trim() : null,
        image: image ? image.trim() : null,
        plant_id: plant_id ? plant_id.trim() : null,
        plant_name: plant_name ? plant_name.trim() : null
    };

    const createdUser = await commonDao.insertOne(newUserPayload, SCHEMA_NAME);
    logger.info(`New user created: ${createdUser.email} (ID: ${createdUser._id}, EmpID: ${createdUser.employee_id || 'N/A'})`);
    
    // toJSON transform automatically strips the password field
    return createdUser;
};

/**
 * Get all users with pagination and search support (Excludes default admin, non-admins cannot see any ADMINs)
 */
const getalluser = async (params = {}, requestingUser) => {
    const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase().trim();
    const isCallerAdmin = requestingUser && requestingUser.role === 'ADMIN';

    // Never display the system admin (admin@gmail.com) in the user management table
    const conditions = [
        { email: { $ne: defaultAdminEmail } }
    ];

    // Non-admin callers cannot see ANY admin users
    if (!isCallerAdmin) {
        conditions.push({ role: { $ne: 'ADMIN' } });
    }

    // Search query support (username, email, employee_id, plant_name regex)
    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        conditions.push({
            $or: [
                { username: searchRegex },
                { email: searchRegex },
                { employee_id: searchRegex },
                { plant_name: searchRegex }
            ]
        });
    }

    // Filter by plant_id if provided
    if (params.plant_id && typeof params.plant_id === 'string' && params.plant_id.trim()) {
        conditions.push({ plant_id: params.plant_id.trim() });
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };

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
};

/**
 * Get single user by ID
 */
const getuser = async (id, requestingUser) => {
    const user = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!user) {
        const error = new Error(`User with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    // Non-admin callers cannot view ADMIN accounts
    if (requestingUser && requestingUser.role !== 'ADMIN' && user.role === 'ADMIN') {
        const error = new Error(`User with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    return user;
};

/**
 * Update an existing user
 */
const updateuser = async (updateData, id) => {
    // Check if user exists
    const user = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!user) {
        const error = new Error(`User with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    const payload = { ...updateData };

    // Check employee_id uniqueness if updated
    if (payload.employee_id && payload.employee_id.trim()) {
        payload.employee_id = payload.employee_id.trim();
        const existingEmp = await commonDao.findOneData(
            { query: { employee_id: payload.employee_id, _id: { $ne: id } } },
            SCHEMA_NAME
        );
        if (existingEmp) {
            const error = new Error(`User with Employee ID '${payload.employee_id}' already exists.`);
            error.statusCode = 409;
            throw error;
        }
    }

    // Clean up old image if a new image is uploaded or image is cleared
    if (payload.image !== undefined && payload.image !== user.image) {
        deleteLocalImageFile(user.image);
    }

    // If updating password, hash it
    if (payload.password) {
        payload.password = await bcrypt.hash(payload.password, saltRounds);
    }

    // Prevent updating _id
    delete payload._id;

    await commonDao.updateOne(
        {
            filter: { _id: id },
            update: { $set: payload }
        },
        SCHEMA_NAME
    );

    logger.info(`User updated: ${id}`);
    return await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
};

/**
 * Delete user by ID
 */
const deleteuser = async (id) => {
    const user = await commonDao.findOneData({ query: { _id: id } }, SCHEMA_NAME);
    if (!user) {
        const error = new Error(`User with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
    }

    // Protect ADMIN users from deletion
    if (user.role === 'ADMIN') {
        const error = new Error('Admin users cannot be deleted.');
        error.statusCode = 403;
        throw error;
    }

    // Clean up stored image file if exists
    if (user.image) {
        deleteLocalImageFile(user.image);
    }

    await commonDao.deleteOne({ _id: id }, SCHEMA_NAME);
    logger.info(`User deleted: ${id}`);
    return { message: 'User deleted successfully', id };
};

module.exports = {
    adduser,
    getalluser,
    getuser,
    updateuser,
    deleteuser
};
