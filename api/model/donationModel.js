const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
    {
        user_id: {
            type: String,
            required: [true, 'User ID is required'],
            trim: true
        },
        username: {
            type: String,
            trim: true,
            default: null
        },
        type: {
            type: String,
            required: [true, 'Donation type is required'],
            enum: ['UPI', 'Cash', 'Cheque'],
            trim: true
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be greater than 0']
        },
        remarks: {
            type: String,
            trim: true,
            default: null
        },
        whatsapp_send: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date,
            default: Date.now,
            required: [true, 'Donation date is required']
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

donationSchema.index({ user_id: 1 });
donationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('donations', donationSchema);
