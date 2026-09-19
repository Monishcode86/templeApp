const express = require('express');
const {
    adduserController,
    getuserController,
    updateuserController,
    deleteuserController,
    getalluserController,
    uploadAvatarController
} = require('../controller/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadUserAvatar } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Require JWT authentication for all user management endpoints
router.use(authenticateToken);

// User CRUD endpoints
router.post('/', adduserController);
router.get('/', getalluserController);
router.post('/upload-avatar', uploadUserAvatar.single('image'), uploadAvatarController);
router.get('/:id', getuserController);
router.put('/:id', updateuserController);
router.delete('/:id', deleteuserController);

module.exports = router;
