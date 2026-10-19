const UserModel = require('../model/userModel');
const DonationModel = require('../model/donationModel');
const FailedNotificationModel = require('../model/failedNotificationModel');

const schema = {
    users: UserModel,
    user: UserModel,
    UserModel: UserModel,
    donations: DonationModel,
    donation: DonationModel,
    failed_notifications: FailedNotificationModel,
    failed_notification: FailedNotificationModel
};

module.exports = schema;
