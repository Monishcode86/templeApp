const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
    {
        shift_id: {
            type: Number
            // Auto-assigned per plant via pre-save hook (1, 2, 3, ...)
        },
        shift_name: {
            type: String,
            required: [true, 'Shift name is required'],
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
        start_time: {
            type: String,
            required: [true, 'Start time is required'],
            match: [/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Start time must be in HH:mm:ss format']
        },
        end_time: {
            type: String,
            required: [true, 'End time is required'],
            match: [/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'End time must be in HH:mm:ss format']
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Auto-increment shift_id per plant before save (each plant starts from 1)
shiftSchema.pre('save', async function () {
    if (this.isNew) {
        const lastShift = await this.constructor.findOne(
            { plant_id: this.plant_id },
            {},
            { sort: { shift_id: -1 } }
        );
        this.shift_id = lastShift && lastShift.shift_id ? lastShift.shift_id + 1 : 1;
    }
});

shiftSchema.index({ plant_id: 1, shift_id: 1 }, { unique: true });
shiftSchema.index({ plant_id: 1 });
shiftSchema.index({ shift_name: 1 });

const ShiftModel = mongoose.model('shifts', shiftSchema);

// Migrate/clean up: drop old global shift_id_1 index if it exists, re-sequence shifts per plant starting from 1, and ensure HH:mm:ss format
async function syncShiftIndexesAndSequence() {
    try {
        const collection = ShiftModel.collection;
        const indexes = await collection.indexes();
        const hasGlobalShiftIdIndex = indexes.some(idx => idx.name === 'shift_id_1');
        if (hasGlobalShiftIdIndex) {
            await collection.dropIndex('shift_id_1');
        }

        // Migrate any existing HH:mm to HH:mm:ss
        const allShifts = await ShiftModel.find({});
        for (const s of allShifts) {
            let updated = false;
            let st = s.start_time;
            let et = s.end_time;
            if (st && st.split(':').length === 2) {
                st = `${st}:00`;
                updated = true;
            }
            if (et && et.split(':').length === 2) {
                et = `${et}:00`;
                updated = true;
            }
            if (updated) {
                await ShiftModel.updateOne({ _id: s._id }, { $set: { start_time: st, end_time: et } });
            }
        }

        // Re-sequence existing shifts per plant so every plant starts from shift_id 1
        const plants = await ShiftModel.distinct('plant_id');
        for (const pid of plants) {
            const plantShifts = await ShiftModel.find({ plant_id: pid }).sort({ createdAt: 1, _id: 1 });
            for (let i = 0; i < plantShifts.length; i++) {
                const targetId = i + 1;
                if (plantShifts[i].shift_id !== targetId) {
                    await ShiftModel.updateOne({ _id: plantShifts[i]._id }, { $set: { shift_id: targetId } });
                }
            }
        }
    } catch (err) {
        // Ignore background sync errors if collection is not yet created
    }
}

if (mongoose.connection.readyState === 1) {
    syncShiftIndexesAndSequence();
} else {
    mongoose.connection.on('connected', () => {
        syncShiftIndexesAndSequence();
    });
}

module.exports = ShiftModel;
