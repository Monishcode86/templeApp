/**
 * Recursive sanitizer that removes MongoDB query injection operators ($ and .)
 * Designed to be 100% compatible with Express 5 where req.query is a getter.
 */
function sanitizeData(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'object') {
                sanitizeData(obj[i]);
            }
        }
        return;
    }

    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeData(obj[key]);
        }
    }
}

/**
 * Express 5 compatible NoSQL query injection sanitizer
 */
const sanitizeMiddleware = (req, res, next) => {
    if (req.body) sanitizeData(req.body);
    if (req.params) sanitizeData(req.params);
    if (req.query) sanitizeData(req.query);
    next();
};

module.exports = sanitizeMiddleware;
