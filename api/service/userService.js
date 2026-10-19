const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');

const SCHEMA_NAME = 'users';
const saltRounds = Number(process.env.HASH_ROUNDS || 10);

/**
 * Generate a random 6-character alphanumeric user ID (letters and numbers)
 */
const generateRandomUserId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

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
 * Add a new user (Only ADMIN)
 */
const adduser = async (userData, currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only ADMIN users can create new users.');
        error.statusCode = 403;
        throw error;
    }

    const {
        username,
        email,
        password,
        role,
        user_id,
        employee_id,
        image,
        address,
        country_code,
        mobile_number,
        alt_country_code,
        alt_mobile_number
    } = userData;

    if (!username || !username.trim()) {
        const error = new Error('Username is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!address || !address.trim()) {
        const error = new Error('Address is required.');
        error.statusCode = 400;
        throw error;
    }

    // Email is optional. If provided, check valid format and uniqueness
    let cleanEmail = null;
    if (email && typeof email === 'string' && email.trim()) {
        cleanEmail = email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            const error = new Error('Please provide a valid email address.');
            error.statusCode = 400;
            throw error;
        }
        const existingEmail = await commonDao.findOneData({ query: { email: cleanEmail } }, SCHEMA_NAME);
        if (existingEmail) {
            const error = new Error(`User with email '${cleanEmail}' already exists.`);
            error.statusCode = 409;
            throw error;
        }
    }

    // User ID: 6-digit random alphanumeric (text and numbers)
    // If 6 digit already present in db, again generate new 6 digit in api and store in db
    let assignedUserId = (user_id || employee_id || '').trim();
    if (assignedUserId) {
        const existingUser = await commonDao.findOneData(
            { query: { $or: [{ user_id: assignedUserId }, { employee_id: assignedUserId }] } },
            SCHEMA_NAME
        );
        if (existingUser) {
            // Already present in db! Generate a new unique 6-digit alphanumeric user_id
            for (let attempts = 0; attempts < 30; attempts++) {
                const newId = generateRandomUserId();
                const check = await commonDao.findOneData(
                    { query: { $or: [{ user_id: newId }, { employee_id: newId }] } },
                    SCHEMA_NAME
                );
                if (!check) {
                    assignedUserId = newId;
                    break;
                }
            }
        }
    } else {
        // Generate a fresh unique 6-digit alphanumeric user_id
        for (let attempts = 0; attempts < 30; attempts++) {
            const newId = generateRandomUserId();
            const check = await commonDao.findOneData(
                { query: { $or: [{ user_id: newId }, { employee_id: newId }] } },
                SCHEMA_NAME
            );
            if (!check) {
                assignedUserId = newId;
                break;
            }
        }
    }

    // Default password is 'welcome' if not provided
    const rawPassword = password && password.trim() ? password.trim() : 'welcome';
    const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);

    const newUserPayload = {
        username: username.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: role || 'USER',
        user_id: assignedUserId,
        image: image ? image.trim() : null,
        address: address.trim(),
        country_code: country_code ? country_code.trim() : '+91',
        mobile_number: mobile_number && mobile_number.trim() ? mobile_number.trim() : null,
        alt_country_code: alt_country_code ? alt_country_code.trim() : '+91',
        alt_mobile_number: alt_mobile_number && alt_mobile_number.trim() ? alt_mobile_number.trim() : null
    };

    const createdUser = await commonDao.insertOne(newUserPayload, SCHEMA_NAME);
    logger.info(`New user created: ${createdUser.username} (ID: ${createdUser._id}, UserID: ${createdUser.user_id})`);
    
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

    // Search query support (username, email, user_id, address, mobile_number regex)
    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        conditions.push({
            $or: [
                { username: searchRegex },
                { email: searchRegex },
                { user_id: searchRegex },
                { employee_id: searchRegex },
                { address: searchRegex },
                { mobile_number: searchRegex }
            ]
        });
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

    // Address is required if provided
    if (payload.address !== undefined) {
        if (!payload.address || !payload.address.trim()) {
            const error = new Error('Address is required.');
            error.statusCode = 400;
            throw error;
        }
        payload.address = payload.address.trim();
    }

    // Check user_id uniqueness if updated
    const updatedUserId = payload.user_id || payload.employee_id;
    if (updatedUserId && typeof updatedUserId === 'string' && updatedUserId.trim()) {
        payload.user_id = updatedUserId.trim();
        const existingId = await commonDao.findOneData(
            {
                query: {
                    $or: [{ user_id: payload.user_id }, { employee_id: payload.user_id }],
                    _id: { $ne: id }
                }
            },
            SCHEMA_NAME
        );
        if (existingId) {
            const error = new Error(`User with User ID '${payload.user_id}' already exists.`);
            error.statusCode = 409;
            throw error;
        }
    }

    // Check email uniqueness and format if updated
    if (payload.email !== undefined) {
        if (payload.email && payload.email.trim()) {
            payload.email = payload.email.toLowerCase().trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(payload.email)) {
                const error = new Error('Please provide a valid email address.');
                error.statusCode = 400;
                throw error;
            }
            const existingEmail = await commonDao.findOneData(
                {
                    query: { email: payload.email, _id: { $ne: id } }
                },
                SCHEMA_NAME
            );
            if (existingEmail) {
                const error = new Error(`User with email '${payload.email}' already exists.`);
                error.statusCode = 409;
                throw error;
            }
        } else {
            payload.email = null;
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

    // Remove legacy plant fields if present
    delete payload.plant_id;
    delete payload.plant_name;
    delete payload.employee_id;

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

