const mongoose = require('mongoose');

const subReasonSchema = new mongoose.Schema(
    {
        subreason_id: {
            type: String,
            required: [true, 'Sub-reason ID is required'],
            trim: true
        },
        sub_reason: {
            type: String,
            required: [true, 'Sub-reason description is required'],
            trim: true
        }
    },
    { _id: false }
);

const downtimeSchema = new mongoose.Schema(
    {
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
        downtime_type: {
            type: String,
            required: [true, 'Downtime type is required'],
            enum: ['rejection', 'downtime'],
            trim: true
        },
        reason_id: {
            type: String
            // Auto-assigned per plant and downtime_type:
            // RE-1, RE-2... for rejection
            // DT-1, DT-2... for downtime
        },
        mainreason_id: {
            type: String,
            required: [true, 'Main reason ID is required'],
            trim: true
        },
        main_reason: {
            type: String,
            required: [true, 'Main reason description is required'],
            trim: true
        },
        // Single primary sub-reason fields (for direct access/display)
        subreason_id: {
            type: String,
            trim: true
        },
        sub_reason: {
            type: String,
            trim: true
        },
        // Array of sub-reasons under this reason
        sub_reasons: {
            type: [subReasonSchema],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Auto-increment reason_id per plant and downtime_type
downtimeSchema.pre('save', async function () {
    if (this.isNew && !this.reason_id) {
        const prefix = this.downtime_type === 'rejection' ? 'RE-' : 'DT-';
        const existingDocs = await this.constructor.find(
            { plant_id: this.plant_id, downtime_type: this.downtime_type },
            { reason_id: 1 }
        );

        let maxNumber = 0;
        for (const doc of existingDocs) {
            if (doc.reason_id && doc.reason_id.startsWith(prefix)) {
                const num = parseInt(doc.reason_id.replace(prefix, ''), 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        }
        this.reason_id = `${prefix}${maxNumber + 1}`;
    }

    // Sync primary subreason_id & sub_reason with sub_reasons array if needed
    if (this.sub_reasons && this.sub_reasons.length > 0) {
        if (!this.subreason_id) {
            this.subreason_id = this.sub_reasons[0].subreason_id;
        }
        if (!this.sub_reason) {
            this.sub_reason = this.sub_reasons[0].sub_reason;
        }
    } else if (this.subreason_id && this.sub_reason) {
        this.sub_reasons = [
            {
                subreason_id: this.subreason_id,
                sub_reason: this.sub_reason
            }
        ];
    }
});

// Indexes
downtimeSchema.index({ plant_id: 1, downtime_type: 1, reason_id: 1 }, { unique: true });
downtimeSchema.index({ plant_id: 1, downtime_type: 1, mainreason_id: 1 }, { unique: true });
downtimeSchema.index({ plant_id: 1, downtime_type: 1 });
downtimeSchema.index({ plant_id: 1 });

const DowntimeModel = mongoose.model('downtimes', downtimeSchema);

module.exports = DowntimeModel;
