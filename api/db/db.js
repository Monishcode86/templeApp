const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const UserModel = require('../model/userModel');
const logger = require('../config/logger');

const URI = process.env.URI;
const adminPassword = process.env.adminUserPasssword || process.env.ADMIN_PASSWORD;
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase().trim();
const saltRounds = Number(process.env.HASH_ROUNDS ?? process.env.HASHROUNT ?? 10);

// Mongoose connection event listeners
mongoose.connection.on('connecting', () => {
    logger.info('MongoDB: Connecting...');
});

mongoose.connection.on('connected', () => {
    logger.info('MongoDB: Connection established successfully.');
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB: Connection disconnected.');
});

mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB Error: ${err.message}`, { error: err });
});

/**
 * Initialize database connection and auto-seed admin if not present
 */
async function initDB() {
    if (!URI) {
        const errorMsg = 'MongoDB URI is missing in environment variables.';
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }

    try {
        const mongooseOptions = {
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
            minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            autoIndex: process.env.NODE_ENV !== 'production'
        };

        await mongoose.connect(URI, mongooseOptions);
        await initAdmin();
    } catch (error) {
        logger.error(`Failed to connect to MongoDB: ${error.message}`);
        throw error;
    }
}

/**
 * Hash password helper
 */
function hashedPassword(passwordValue, rounds) {
    return bcrypt.hash(passwordValue, rounds);
}

/**
 * Idempotent Admin user seeding
 */
async function initAdmin() {
    if (!adminPassword) {
        logger.warn('Admin password not set in environment. Skipping default admin initialization.');
        return;
    }

    try {
        const existingAdmin = await UserModel.findOne({ email: adminEmail });

        if (!existingAdmin) {
            const hashedPasswordValue = await hashedPassword(adminPassword, saltRounds);
            const admin = {
                username: 'admin',
                password: hashedPasswordValue,
                role: 'ADMIN',
                email: adminEmail
            };

            await UserModel.create(admin);
            logger.info(`Default Admin user created successfully: ${adminEmail}`);
        } else {
            logger.info(`Admin user already exists: ${adminEmail}`);
        }
    } catch (error) {
        logger.error(`Error while initializing admin user: ${error.message}`);
    }
}

/**
 * Disconnect database cleanly during graceful shutdown
 */
async function closeDB() {
    try {
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed successfully.');
    } catch (err) {
        logger.error(`Error while closing MongoDB connection: ${err.message}`);
    }
}

module.exports = {
    initDB,
    closeDB
};
