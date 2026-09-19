const mongoose = require('mongoose');

const machineTypeSchema = new mongoose.Schema(
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
        machinetype_id: {
            type: String
            // Auto-assigned per plant: M1, M2, M3...
        },
        machinetype: {
            type: String,
            required: [true, 'Machine type name is required'],
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Auto-increment machinetype_id per plant before save (each plant starts from M1)
machineTypeSchema.pre('save', async function () {
    if (this.isNew && !this.machinetype_id) {
        const plantMachineTypes = await this.constructor.find(
            { plant_id: this.plant_id },
            { machinetype_id: 1 }
        );

        let maxNumber = 0;
        for (const item of plantMachineTypes) {
            if (item.machinetype_id) {
                const match = item.machinetype_id.match(/^M(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        }

        this.machinetype_id = `M${maxNumber + 1}`;
    }
});

// Compound unique indexes
machineTypeSchema.index({ plant_id: 1, machinetype_id: 1 }, { unique: true });
machineTypeSchema.index({ plant_id: 1, machinetype: 1 }, { unique: true });
machineTypeSchema.index({ plant_id: 1 });

const MachineTypeModel = mongoose.model('machinetypes', machineTypeSchema);

module.exports = MachineTypeModel;
