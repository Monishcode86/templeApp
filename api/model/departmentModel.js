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
            type: String
            // Auto-assigned per plant via pre-save hook (Dep-1, Dep-2, ...)
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

// Auto-increment department_id per plant before save (each plant starts from Dep-1)
departmentSchema.pre('save', async function () {
    if (this.isNew && !this.department_id) {
        // Find departments for THIS plant only to determine highest numerical ID
        const plantDepts = await this.constructor.find(
            { plant_id: this.plant_id },
            { department_id: 1 }
        );
        let maxNumber = 0;
        for (const dept of plantDepts) {
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

// Indexes: Department ID and name are unique per plant
departmentSchema.index({ plant_id: 1, department_id: 1 }, { unique: true });
departmentSchema.index({ plant_id: 1, department_name: 1 }, { unique: true });
departmentSchema.index({ plant_id: 1 });

const DepartmentModel = mongoose.model('departments', departmentSchema);

/**
 * Drop old global department_id_1 index if it exists, and re-sequence existing departments per plant so each plant starts from Dep-1
 */
async function syncDepartmentIndexesAndSequence() {
    try {
        const collection = DepartmentModel.collection;
        const indexes = await collection.indexes();
        const hasGlobalDeptIdIndex = indexes.some(idx => idx.name === 'department_id_1');
        if (hasGlobalDeptIdIndex) {
            await collection.dropIndex('department_id_1');
        }

        // Re-sequence existing departments per plant so every plant starts from Dep-1
        const distinctPlants = await DepartmentModel.distinct('plant_id');
        for (const pid of distinctPlants) {
            const plantDepts = await DepartmentModel.find({ plant_id: pid }).sort({ createdAt: 1, _id: 1 });
            for (let i = 0; i < plantDepts.length; i++) {
                const targetId = `Dep-${i + 1}`;
                if (plantDepts[i].department_id !== targetId) {
                    await DepartmentModel.updateOne(
                        { _id: plantDepts[i]._id },
                        { $set: { department_id: targetId } }
                    );
                }
            }
        }
    } catch (err) {
        // Ignore background sync errors if collection is not yet ready
    }
}

if (mongoose.connection.readyState === 1) {
    syncDepartmentIndexesAndSequence();
} else {
    mongoose.connection.on('connected', () => {
        syncDepartmentIndexesAndSequence();
    });
}

module.exports = DepartmentModel;
