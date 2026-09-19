const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema(
    {
        plant_id: {
            type: String,
            required: [true, 'Plant ID is required'],
            unique: true,
            trim: true,
            uppercase: true
        },
        plant_name: {
            type: String,
            required: [true, 'Plant name is required'],
            trim: true
        },
        location: {
            type: String,
            required: [true, 'Location is required'],
            trim: true
        },
        plant_img: {
            type: String,
            trim: true,
            default: null
        },
        pincode: {
            type: String,
            required: [true, 'Pincode is required'],
            trim: true
        },
        no_of_employee: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

plantSchema.index({ plant_name: 1 });

module.exports = mongoose.model('plants', plantSchema);
