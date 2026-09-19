const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema(
    {
        operation_name: {
            type: String,
            required: [true, 'Operation name / ID is required'],
            trim: true
        },
        run_time: {
            type: Number,
            required: [true, 'Run time (ms) is required'],
            min: [0, 'Run time must be a non-negative number'],
            default: 0
        },
        load_time: {
            type: Number,
            required: [true, 'Load time (ms) is required'],
            min: [0, 'Load time must be a non-negative number'],
            default: 0
        },
        unload_time: {
            type: Number,
            required: [true, 'Unload time (ms) is required'],
            min: [0, 'Unload time must be a non-negative number'],
            default: 0
        },
        cycle_type: {
            type: String,
            enum: ['part_per_cycle', 'unit_per_parts'],
            default: 'part_per_cycle'
        },
        count: {
            type: Number,
            required: [true, 'Count is required'],
            min: [1, 'Count must be at least 1'],
            default: 1
        }
    },
    { _id: false }
);

const partSchema = new mongoose.Schema(
    {
        part_id: {
            type: String
            // Auto-assigned per plant via pre-save hook (Po-1, Po-2, ...)
        },
        program_number: {
            type: String,
            required: [true, 'Program number is required'],
            trim: true,
            unique: true
        },
        part_name: {
            type: String,
            required: [true, 'Part name is required'],
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
        has_operation: {
            type: Boolean,
            default: false
        },
        // Top-level cycle parameters (when has_operation === false)
        run_time: {
            type: Number,
            min: [0, 'Run time must be a non-negative number'],
            default: 0
        },
        load_time: {
            type: Number,
            min: [0, 'Load time must be a non-negative number'],
            default: 0
        },
        unload_time: {
            type: Number,
            min: [0, 'Unload time must be a non-negative number'],
            default: 0
        },
        cycle_type: {
            type: String,
            enum: ['part_per_cycle', 'unit_per_parts'],
            default: 'part_per_cycle'
        },
        count: {
            type: Number,
            min: [1, 'Count must be at least 1'],
            default: 1
        },
        // Multiple operations (when has_operation === true)
        operations: {
            type: [operationSchema],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Auto-increment part_id per plant before save (each plant starts from Po-1)
partSchema.pre('save', async function () {
    if (this.isNew && !this.part_id) {
        const plantParts = await this.constructor.find(
            { plant_id: this.plant_id },
            { part_id: 1 }
        );
        let maxNumber = 0;
        for (const p of plantParts) {
            if (p.part_id && p.part_id.startsWith('Po-')) {
                const num = parseInt(p.part_id.replace('Po-', ''), 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        }
        this.part_id = `Po-${maxNumber + 1}`;
    }
});

// Indexes
partSchema.index({ plant_id: 1, part_id: 1 }, { unique: true });
partSchema.index({ plant_id: 1, part_name: 1 }, { unique: true });
partSchema.index({ plant_id: 1 });

const PartModel = mongoose.model('parts', partSchema);

/**
 * Drop any legacy conflicting indexes and verify sequence
 */
async function syncPartIndexesAndSequence() {
    try {
        const collection = PartModel.collection;
        const indexes = await collection.indexes();
        const hasGlobalPartIdIndex = indexes.some(idx => idx.name === 'part_id_1');
        if (hasGlobalPartIdIndex) {
            await collection.dropIndex('part_id_1');
        }

        // Re-sequence existing parts per plant if any
        const distinctPlants = await PartModel.distinct('plant_id');
        for (const pid of distinctPlants) {
            const plantParts = await PartModel.find({ plant_id: pid }).sort({ createdAt: 1, _id: 1 });
            for (let i = 0; i < plantParts.length; i++) {
                const targetId = `Po-${i + 1}`;
                if (plantParts[i].part_id !== targetId) {
                    await PartModel.updateOne(
                        { _id: plantParts[i]._id },
                        { $set: { part_id: targetId } }
                    );
                }
            }
        }
    } catch (err) {
        // Ignore background sync errors if collection is not yet ready
    }
}

if (mongoose.connection.readyState === 1) {
    syncPartIndexesAndSequence();
} else {
    mongoose.connection.on('connected', () => {
        syncPartIndexesAndSequence();
    });
}

module.exports = PartModel;
