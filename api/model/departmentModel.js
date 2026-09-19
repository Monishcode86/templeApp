const mongoose = require('mongoose');

const departmentShiftSchema = new mongoose.Schema(
    {
        shift_id: {
            type: Number,
            required: true
        },
        shift_name: {
            type: String,
            required: true,
            trim: true
        },
        start_time: {
            type: String,
            required: true,
            match: [/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Start time must be in HH:mm:ss format']
        },
        end_time: {
            type: String,
            required: true,
            match: [/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'End time must be in HH:mm:ss format']
        },
        duration: {
            type: String,
            default: ''
        }
    },
    { _id: false }
);

const departmentSchema = new mongoose.Schema(
    {
        department_id: {
            type: String,
            unique: true
            // Auto-assigned via pre-save hook (Dep-1, Dep-2, ...)
        },
        department_name: {
            type: String,
            required: [true, 'Department name is required'],
            trim: true
        },
        plant_id: {
            type: String,
            required: [true, 'Plant ID is required'],
            trim: true,
            uppercase: true
        },
        plant_name: {
            type: String,
            required: [true, 'Plant name is required'],
            trim: true
        },
        is_shift: {
            type: Boolean,
            default: true
        },
        shift_data: {
            type: [departmentShiftSchema],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Auto-increment department_id (Dep-1, Dep-2, ...) before save
departmentSchema.pre('save', async function () {
    if (this.isNew && !this.department_id) {
        // Find all departments to determine highest numerical ID
        const allDepts = await this.constructor.find({}, { department_id: 1 });
        let maxNumber = 0;
        for (const dept of allDepts) {
            if (dept.department_id && dept.department_id.startsWith('Dep-')) {
                const num = parseInt(dept.department_id.replace('Dep-', ''), 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        }
        this.department_id = `Dep-${maxNumber + 1}`;
    }
});

departmentSchema.index({ plant_id: 1, department_name: 1 }, { unique: true });
departmentSchema.index({ plant_id: 1 });

module.exports = mongoose.model('departments', departmentSchema);
