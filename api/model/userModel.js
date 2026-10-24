const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Family member username is required'],
            trim: true
        },
        email: {
            type: String,
            required: false,
            lowercase: true,
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
            required: false,
            trim: true,
            default: null
        },
        relation_type: {
            type: String,
            required: [true, 'Relation type is required'],
            trim: true
        }
    },
    { _id: true }
);

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
        address_line1: {
            type: String,
            trim: true,
            default: null
        },
        address_line2: {
            type: String,
            trim: true,
            default: null
        },
        nation: {
            type: String,
            trim: true,
            default: null
        },
        state: {
            type: String,
            trim: true,
            default: null
        },
        city: {
            type: String,
            trim: true,
            default: null
        },
        pincode: {
            type: String,
            trim: true,
            default: null
        },
        address: {
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
        alt_country_code: {
            type: String,
            trim: true,
            default: '+91'
        },
        alt_mobile_number: {
            type: String,
            trim: true,
            default: null
        },
        family_data: {
            type: [familyMemberSchema],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                delete ret.password;
                return ret;
            }
        },
        toObject: { virtuals: true }
    }
);

// Helpful single and compound indexes
userSchema.index({ user_id: 1 });
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ nation: 1 });
userSchema.index({ state: 1 });
userSchema.index({ city: 1 });
userSchema.index({ 'family_data.username': 1 });
userSchema.index({ 'family_data.email': 1 }, { sparse: true });

module.exports = mongoose.model('users', userSchema);

