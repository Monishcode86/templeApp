const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const sanitizeMiddleware = require('../middleware/sanitizeMiddleware');
const requestLogger = require('../middleware/requestLogger');
const errorMiddleware = require('../middleware/errorMiddleware');
const router = require('../router/index');

const app = express();

// Security HTTP headers with cross-origin resource policy for image assets
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Serve static uploaded files under /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// CORS configuration (supports onprem intranet or cloud domains)
const corsOptions = {
    origin: process.env.CORS_ORIGIN === '*' ? '*' : (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection (Express 5 compatible)
app.use(sanitizeMiddleware);

// Prevent HTTP Parameter Pollution attacks
app.use(hpp());

// Rate limiting to protect against brute-force and DoS attacks
const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes default
    max: Number(process.env.RATE_LIMIT_MAX || 100), // limit each IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'Error',
        statusCode: 429,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});
app.use('/api', limiter);

// HTTP request logging (persisted to rotating Winston files and console)
app.use(requestLogger);

// Global Health Check endpoint (useful for load balancers / container health probes)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        service: 'node24api',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Mount main API router under /api
app.use('/api', router);

// 404 Fallback for unmatched routes
app.use((req, res, next) => {
    const error = new Error(`Resource not found: ${req.method} ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
});

// Global centralized error handler
app.use(errorMiddleware);

module.exports = app;
