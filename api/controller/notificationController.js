const {
    getPendingNotifications,
    sendDonationNotification,
    sendBulkNotifications,
    getFailedNotifications,
    getWhatsAppConnectionStatus
} = require('../service/notificationService');

const getPendingNotificationsController = async (req, res, next) => {
    try {
        const result = await getPendingNotifications(req.query, req.user);
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return next(error);
    }
};

const sendDonationNotificationController = async (req, res, next) => {
    try {
        const result = await sendDonationNotification(req.params.id, req.user);
        return res.status(200).json({
            status: 'Success',
            message: result.message,
            data: result
        });
    } catch (error) {
        return next(error);
    }
};

const sendBulkNotificationsController = async (req, res, next) => {
    try {
        const { donation_ids } = req.body;
        const result = await sendBulkNotifications(donation_ids, req.user);
        return res.status(200).json({
            status: 'Success',
            message: `Dispatched ${result.successful} of ${result.total} WhatsApp notifications.`,
            data: result
        });
    } catch (error) {
        return next(error);
    }
};

const getFailedNotificationsController = async (req, res, next) => {
    try {
        const result = await getFailedNotifications(req.query, req.user);
        return res.status(200).json({
            status: 'Success',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return next(error);
    }
};

const getWhatsAppStatusController = async (req, res, next) => {
    try {
        const status = getWhatsAppConnectionStatus(req.user);
        return res.status(200).json({
            status: 'Success',
            data: status
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getPendingNotificationsController,
    sendDonationNotificationController,
    sendBulkNotificationsController,
    getFailedNotificationsController,
    getWhatsAppStatusController
};
