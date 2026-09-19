const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Allowed image MIME types and extensions
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Configure Multer disk storage for a given subfolder (e.g. 'users' or 'plants')
 */
const createDiskStorage = (subfolder) => {
    const uploadDir = path.join(__dirname, `../uploads/${subfolder}`);

    // Ensure upload directory exists synchronously on startup
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    return multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const safeRandom = crypto.randomBytes(6).toString('hex');
            const safeName = `${subfolder}-${Date.now()}-${safeRandom}${ext}`;
            cb(null, safeName);
        }
    });
};

/**
 * File filter to validate image formats
 */
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    } else {
        const error = new Error('Invalid image file format. Only JPG, PNG, and WebP images are allowed.');
        error.statusCode = 400;
        cb(error, false);
    }
};

// Multer instance for User avatars (Max 5MB)
const uploadUserAvatar = multer({
    storage: createDiskStorage('users'),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Multer instance for Plant images (Max 5MB)
const uploadPlantImage = multer({
    storage: createDiskStorage('plants'),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = {
    uploadUserAvatar,
    uploadPlantImage
};
