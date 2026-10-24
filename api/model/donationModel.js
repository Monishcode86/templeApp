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
        financial_year: {
            type: String,
            required: [true, 'Financial year is required'],
            trim: true
        },
        receipt_no: {
            type: Number,
            required: [true, 'Receipt number is required']
        },
        receipt_number: {
            type: String,
            required: [true, 'Formatted receipt number is required'],
            trim: true
        },
        donor_name: {
            type: String,
            trim: true,
            default: null
        },
        donor_mobile: {
            type: String,
            trim: true,
            default: null
        },
        donor_email: {
            type: String,
            trim: true,
            default: null
        },
        donor_address: {
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
        upi_ref_no: {
            type: String,
            trim: true,
            default: null
        },
        cheque_no: {
            type: String,
            trim: true,
            default: null
        },
        bank_name: {
            type: String,
            trim: true,
            default: null
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be greater than 0'],
            max: [9999999999, 'Amount cannot exceed 9999999999']
        },
        amount_in_words: {
            type: String,
            trim: true,
            default: null
        },
        amount_in_words_ta: {
            type: String,
            trim: true,
            default: null
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

donationSchema.index({ financial_year: 1, receipt_no: 1 }, { unique: true });
donationSchema.index({ receipt_number: 1 });
donationSchema.index({ user_id: 1 });
donationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('donations', donationSchema);
