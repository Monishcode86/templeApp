const express = require('express');
const {
    getPendingNotificationsController,
    sendDonationNotificationController,
    sendBulkNotificationsController,
    getFailedNotificationsController,
    getWhatsAppStatusController
} = require('../controller/notificationController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// All notification management endpoints require authentication and ADMIN role
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

router.get('/pending', getPendingNotificationsController);
router.post('/send/:id', sendDonationNotificationController);
router.post('/send-bulk', sendBulkNotificationsController);
router.get('/failed', getFailedNotificationsController);
router.get('/status', getWhatsAppStatusController);

module.exports = router;
