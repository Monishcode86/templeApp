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
 * Validate that all provided emails are unique:
 * 1. Internally: No two entities (main user or family members) in the same submission share an email.
 * 2. Globally: None of the emails match ANY existing user's email or ANY family member's email in MongoDB.
 * 
 * @param {string|null} mainEmail - Clean lowercase main user email (or null)
 * @param {Array} familyList - Clean array of family member objects [{ username, email, ... }]
 * @param {string|null} excludeUserId - Document _id to exclude (during update)
 */
const validateEmailUniqueness = async (mainEmail, familyList = [], excludeUserId = null) => {
    const emailsWithSources = [];

    if (mainEmail && typeof mainEmail === 'string' && mainEmail.trim()) {
        emailsWithSources.push({
            email: mainEmail.toLowerCase().trim(),
            source: 'Main user'
        });
    }

    if (Array.isArray(familyList)) {
        familyList.forEach((m, idx) => {
            if (m && m.email && typeof m.email === 'string' && m.email.trim()) {
                emailsWithSources.push({
                    email: m.email.toLowerCase().trim(),
                    source: `Family member #${idx + 1} (${m.username || 'unnamed'})`
                });
            }
        });
    }

    if (emailsWithSources.length === 0) return;

    // 1. Check internal duplicates within this form submission
    const seen = new Map();
    for (const item of emailsWithSources) {
        if (seen.has(item.email)) {
            const firstSource = seen.get(item.email);
            const error = new Error(
                `Email '${item.email}' is used more than once in this form (${firstSource} and ${item.source}). Email must be unique.`
            );
            error.statusCode = 409;
            throw error;
        }
        seen.set(item.email, item.source);
    }

    // 2. Check each email against MongoDB (both main user email and family_data.email)
    const emailList = Array.from(seen.keys());
    for (const email of emailList) {
        const query = {
            $or: [
                { email: email },
                { 'family_data.email': email }
            ]
        };

        if (excludeUserId) {
            query._id = { $ne: excludeUserId };
        }

        const conflict = await commonDao.findOneData({ query }, SCHEMA_NAME);
        if (conflict) {
            const isMain = conflict.email === email;
            let detail = '';
            if (isMain) {
                detail = `user '${conflict.username}'`;
            } else {
                const matchedMember = (conflict.family_data || []).find(
                    f => f && f.email && f.email.toLowerCase().trim() === email
                );
                detail = `family member '${matchedMember?.username || 'member'}' of user '${conflict.username}'`;
            }
            const error = new Error(`Email '${email}' is already in use by ${detail}. Email must be unique.`);
            error.statusCode = 409;
            throw error;
        }
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
        address_line1,
        address_line2,
        nation,
        state,
        city,
        pincode,
        country_code,
        mobile_number,
        alt_country_code,
        alt_mobile_number,
        family_data
    } = userData;

    if (!username || !username.trim()) {
        const error = new Error('Username is required.');
        error.statusCode = 400;
        throw error;
    }

    const cleanLine1 = (address_line1 || '').trim();
    const cleanLine2 = (address_line2 || '').trim();
    const cleanNation = (nation || '').trim();
    const cleanState = (state || '').trim();
    const cleanCity = (city || '').trim();
    const cleanPincode = (pincode || '').trim();
    const rawAddress = (address || '').trim();

    if (!cleanLine1 && !rawAddress) {
        const error = new Error('Address Line 1 is required.');
        error.statusCode = 400;
        throw error;
    }
    if (cleanLine1 && !cleanNation && !rawAddress) {
        const error = new Error('Nation is required.');
        error.statusCode = 400;
        throw error;
    }
    if (cleanLine1 && !cleanState && !rawAddress) {
        const error = new Error('State is required.');
        error.statusCode = 400;
        throw error;
    }
    if (cleanLine1 && !cleanCity && !rawAddress) {
        const error = new Error('City is required.');
        error.statusCode = 400;
        throw error;
    }
    if (cleanLine1 && !cleanPincode && !rawAddress) {
        const error = new Error('Pincode is required.');
        error.statusCode = 400;
        throw error;
    }

    // Format composite full address
    let fullAddress = rawAddress;
    if (cleanLine1) {
        const parts = [cleanLine1];
        if (cleanLine2) parts.push(cleanLine2);
        if (cleanCity) parts.push(cleanCity);
        if (cleanState && cleanPincode) parts.push(`${cleanState} - ${cleanPincode}`);
        else if (cleanState) parts.push(cleanState);
        else if (cleanPincode) parts.push(cleanPincode);
        if (cleanNation) parts.push(cleanNation);
        fullAddress = parts.join(', ');
    }

    // Email is optional. If provided, check valid format
    let cleanEmail = null;
    if (email && typeof email === 'string' && email.trim()) {
        cleanEmail = email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            const error = new Error('Please provide a valid email address.');
            error.statusCode = 400;
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
        address: fullAddress || null,
        address_line1: cleanLine1 || null,
        address_line2: cleanLine2 || null,
        nation: cleanNation || null,
        state: cleanState || null,
        city: cleanCity || null,
        pincode: cleanPincode || null,
        country_code: country_code ? country_code.trim() : '+91',
        mobile_number: mobile_number && mobile_number.trim() ? mobile_number.trim() : null,
        alt_country_code: alt_country_code ? alt_country_code.trim() : '+91',
        alt_mobile_number: alt_mobile_number && alt_mobile_number.trim() ? alt_mobile_number.trim() : null
    };

    // Clean and validate optional family_data
    const rawFamily = family_data !== undefined ? family_data : [];
    let cleanFamily = [];
    if (Array.isArray(rawFamily)) {
        for (let i = 0; i < rawFamily.length; i++) {
            const member = rawFamily[i];
            if (!member) continue;
            const mUsername = (member.username || '').trim();
            const mRelation = (member.relation_type || '').trim().toLowerCase();
            if (!mUsername && !mRelation && !member.email && !member.mobile_number) continue;
            if (!mUsername) {
                const error = new Error(`Family member #${i + 1}: Username is required.`);
                error.statusCode = 400;
                throw error;
            }
            if (!mRelation) {
                const error = new Error(`Family member #${i + 1}: Relation type is required.`);
                error.statusCode = 400;
                throw error;
            }
            let mEmail = null;
            if (member.email && typeof member.email === 'string' && member.email.trim()) {
                mEmail = member.email.toLowerCase().trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(mEmail)) {
                    const error = new Error(`Family member #${i + 1}: Please provide a valid email address.`);
                    error.statusCode = 400;
                    throw error;
                }
            }
            cleanFamily.push({
                username: mUsername,
                email: mEmail,
                country_code: member.country_code ? member.country_code.trim() : '+91',
                mobile_number: member.mobile_number && member.mobile_number.trim() ? member.mobile_number.trim() : null,
                relation_type: mRelation
            });
        }
    }

    // Comprehensive Email Uniqueness Check (Form-internal and Database-wide)
    await validateEmailUniqueness(cleanEmail, cleanFamily, null);

    newUserPayload.family_data = cleanFamily;

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
                { address_line1: searchRegex },
                { address_line2: searchRegex },
                { nation: searchRegex },
                { state: searchRegex },
                { city: searchRegex },
                { pincode: searchRegex },
                { mobile_number: searchRegex },
                { 'family_data.username': searchRegex },
                { 'family_data.mobile_number': searchRegex }
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

    // Structured address handling
    const isAddressFieldProvided =
        payload.address_line1 !== undefined ||
        payload.address_line2 !== undefined ||
        payload.nation !== undefined ||
        payload.state !== undefined ||
        payload.city !== undefined ||
        payload.pincode !== undefined ||
        payload.address !== undefined;

    if (isAddressFieldProvided) {
        const line1 = payload.address_line1 !== undefined ? (payload.address_line1 || '').trim() : (user.address_line1 || '').trim();
        const line2 = payload.address_line2 !== undefined ? (payload.address_line2 || '').trim() : (user.address_line2 || '').trim();
        const cleanNation = payload.nation !== undefined ? (payload.nation || '').trim() : (user.nation || '').trim();
        const cleanState = payload.state !== undefined ? (payload.state || '').trim() : (user.state || '').trim();
        const cleanCity = payload.city !== undefined ? (payload.city || '').trim() : (user.city || '').trim();
        const cleanPincode = payload.pincode !== undefined ? (payload.pincode || '').trim() : (user.pincode || '').trim();
        const rawAddress = payload.address !== undefined ? (payload.address || '').trim() : (user.address || '').trim();

        if (payload.address_line1 !== undefined && !line1 && !rawAddress) {
            const error = new Error('Address Line 1 is required.');
            error.statusCode = 400;
            throw error;
        }

        let fullAddress = rawAddress;
        if (line1) {
            const parts = [line1];
            if (line2) parts.push(line2);
            if (cleanCity) parts.push(cleanCity);
            if (cleanState && cleanPincode) parts.push(`${cleanState} - ${cleanPincode}`);
            else if (cleanState) parts.push(cleanState);
            else if (cleanPincode) parts.push(cleanPincode);
            if (cleanNation) parts.push(cleanNation);
            fullAddress = parts.join(', ');
        }

        if (payload.address_line1 !== undefined) payload.address_line1 = line1 || null;
        if (payload.address_line2 !== undefined) payload.address_line2 = line2 || null;
        if (payload.nation !== undefined) payload.nation = cleanNation || null;
        if (payload.state !== undefined) payload.state = cleanState || null;
        if (payload.city !== undefined) payload.city = cleanCity || null;
        if (payload.pincode !== undefined) payload.pincode = cleanPincode || null;
        payload.address = fullAddress || null;
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

    // Check email format if updated
    if (payload.email !== undefined) {
        if (payload.email && typeof payload.email === 'string' && payload.email.trim()) {
            payload.email = payload.email.toLowerCase().trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(payload.email)) {
                const error = new Error('Please provide a valid email address.');
                error.statusCode = 400;
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

    // Clean and validate optional family_data
    const rawFamily = payload.family_data !== undefined ? payload.family_data : undefined;
    if (rawFamily !== undefined) {
        let cleanFamily = [];
        if (Array.isArray(rawFamily)) {
            for (let i = 0; i < rawFamily.length; i++) {
                const member = rawFamily[i];
                if (!member) continue;
                const mUsername = (member.username || '').trim();
                const mRelation = (member.relation_type || '').trim().toLowerCase();
                if (!mUsername && !mRelation && !member.email && !member.mobile_number) continue;
                if (!mUsername) {
                    const error = new Error(`Family member #${i + 1}: Username is required.`);
                    error.statusCode = 400;
                    throw error;
                }
                if (!mRelation) {
                    const error = new Error(`Family member #${i + 1}: Relation type is required.`);
                    error.statusCode = 400;
                    throw error;
                }
                let mEmail = null;
                if (member.email && typeof member.email === 'string' && member.email.trim()) {
                    mEmail = member.email.toLowerCase().trim();
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(mEmail)) {
                        const error = new Error(`Family member #${i + 1}: Please provide a valid email address.`);
                        error.statusCode = 400;
                        throw error;
                    }
                }
                cleanFamily.push({
                    username: mUsername,
                    email: mEmail,
                    country_code: member.country_code ? member.country_code.trim() : '+91',
                    mobile_number: member.mobile_number && member.mobile_number.trim() ? member.mobile_number.trim() : null,
                    relation_type: mRelation
                });
            }
        }
        payload.family_data = cleanFamily;
    }

    // Comprehensive Email Uniqueness Check (Form-internal and Database-wide excluding current user ID)
    const effectiveMainEmail = payload.email !== undefined ? payload.email : user.email;
    const effectiveFamily = payload.family_data !== undefined ? payload.family_data : (user.family_data || []);
    await validateEmailUniqueness(effectiveMainEmail, effectiveFamily, id);

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

