const UserModel = require('../model/userModel');
const DonationModel = require('../model/donationModel');
const FailedNotificationModel = require('../model/failedNotificationModel');
const CounterModel = require('../model/counterModel');

const schema = {
    users: UserModel,
    user: UserModel,
    UserModel: UserModel,
    donations: DonationModel,
    donation: DonationModel,
    failed_notifications: FailedNotificationModel,
    failed_notification: FailedNotificationModel,
    counters: CounterModel,
    counter: CounterModel
};

module.exports = schema;
