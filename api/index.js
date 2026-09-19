require('dotenv').config();

const app = require('./server/server');
const { initDB, closeDB } = require('./db/db');
const logger = require('./config/logger');

const PORT = Number(process.env.PORT || 5000);
let server;

async function init() {
    try {
        // 1. Initialize MongoDB connection and seed default admin
        await initDB();

        // 2. Start HTTP server
        server = app.listen(PORT, () => {
            logger.info(`Server is Running on port ${PORT} [Environment: ${process.env.NODE_ENV || 'development'}]`);
        });

        // Configure server keep-alive timeouts for reverse proxies (NGINX, Cloudflare, ALB)
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

    } catch (error) {
        logger.error(`Critical error during application startup: ${error.message}`, { stack: error.stack });
        process.exit(1);
    }
}

/**
 * Graceful shutdown handler for on-prem (PM2/NSSM) and cloud (Docker/K8s)
 */
async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed. Ceased accepting incoming connections.');
            await closeDB();
            logger.info('Graceful shutdown completed successfully.');
            process.exit(0);
        });

        // Force shutdown after 10 seconds if lingering connections do not terminate
        setTimeout(() => {
            logger.error('Forcefully terminating process: shutdown timeout exceeded (10s).');
            process.exit(1);
        }, 10000).unref();
    } else {
        await closeDB();
        process.exit(0);
    }
}

// OS Process Signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK')); // Windows NSSM / Service signal

// Unhandled Promise Rejections & Uncaught Exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason: reason instanceof Error ? reason.stack : reason });
});

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
    // In production, exit to allow PM2/Docker/NSSM to restart cleanly
    process.exit(1);
});

init();
