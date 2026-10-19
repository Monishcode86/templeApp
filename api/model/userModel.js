const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            trim: true
        },
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        role: {
            type: String,
            required: [true, 'Role is required'],
            enum: ['ADMIN', 'USER'],
            default: 'USER'
        },
        email: {
            type: String,
            required: false,
            lowercase: true,
            trim: true,
            default: null
        },
        user_id: {
            type: String,
            trim: true,
            default: null
        },
        image: {
            type: String,
            trim: true,
            default: null
        },
        address: {
            type: String,
            required: [true, 'Address is required'],
            trim: true
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
        alt_country_code: {
            type: String,
            trim: true,
            default: '+91'
        },
        alt_mobile_number: {
            type: String,
            trim: true,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.password;
                return ret;
            }
        }
    }
);

// Helpful single and compound indexes
userSchema.index({ user_id: 1 });
userSchema.index({ email: 1 }, { sparse: true });

module.exports = mongoose.model('users', userSchema);

