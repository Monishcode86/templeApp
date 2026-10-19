const mongoose = require('mongoose');

const failedNotificationSchema = new mongoose.Schema(
    {
        donation_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'donations',
            required: [true, 'Donation ID is required']
        },
        user_id: {
            type: String,
            required: true,
            trim: true
        },
        username: {
            type: String,
            trim: true,
            default: null
        },
        country_code: {
            type: String,
            trim: true,
            default: '+91'
        },
        mobile_number: {
            type: String,
            trim: true,
            default: null
        },
        amount: {
            type: Number,
            required: true
        },
        donation_type: {
            type: String,
            trim: true,
            default: null
        },
        error_message: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: ['FAILED', 'RESOLVED'],
            default: 'FAILED'
        },
        retry_count: {
            type: Number,
            default: 1
        },
        failed_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

failedNotificationSchema.index({ donation_id: 1 });
failedNotificationSchema.index({ user_id: 1 });
failedNotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('failed_notifications', failedNotificationSchema);
