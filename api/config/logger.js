const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDirectory = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let msg = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` | Meta: ${JSON.stringify(meta)}`;
        }
        if (stack) {
            msg += `\nStack: ${stack}`;
        }
        return msg;
    })
);

// Daily rotate file transport for all application logs (retention: 30 days / 1 month)
const combinedFileTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDirectory, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: process.env.LOG_RETENTION_DAYS || '30d',
    level: 'info'
});

// Daily rotate file transport for error logs (retention: 30 days / 1 month)
const errorFileTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDirectory, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: process.env.LOG_RETENTION_DAYS || '30d',
    level: 'error'
});

const transports = [
    combinedFileTransport,
    errorFileTransport
];

// In non-production or when running in containers/PM2, enable console logging
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOG === 'true') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, stack }) => {
                    return `[${timestamp}] ${level}: ${stack || message}`;
                })
            )
        })
    );
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'node24api' },
    transports,
    exitOnError: false
});

module.exports = logger;
