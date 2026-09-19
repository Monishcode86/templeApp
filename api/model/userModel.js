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
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
        },
        employee_id: {
            type: String,
            trim: true,
            default: null
        },
        image: {
            type: String,
            trim: true,
            default: null
        },
        plant_id: {
            type: String,
            trim: true,
            default: null
        },
        plant_name: {
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

// Helpful compound and single indexes
userSchema.index({ employee_id: 1 });
userSchema.index({ plant_id: 1 });

module.exports = mongoose.model('users', userSchema);
