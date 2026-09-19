const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema(
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
        department_id: {
            type: String,
            required: [true, 'Department ID is required'],
            trim: true
        },
        department_name: {
            type: String,
            required: [true, 'Department name is required'],
            trim: true
        },
        machinetype: {
            type: String,
            required: [true, 'Machine type is required'],
            trim: true
        },
        machinetype_id: {
            type: String,
            trim: true,
            default: ''
        },
        machine_id: {
            type: String
            // Auto-assigned per plant: M1, M2, M3...
        },
        machine_ip: {
            type: String,
            required: [true, 'Machine IP is required'],
            trim: true
        },
        machine_liscence: {
            type: String,
            required: [true, 'Machine license is required'],
            trim: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Auto-increment machine_id per plant before save (each plant starts from M1)
machineSchema.pre('save', async function () {
    if (this.isNew && !this.machine_id) {
        const plantMachines = await this.constructor.find(
            { plant_id: this.plant_id },
            { machine_id: 1 }
        );

        let maxNumber = 0;
        for (const item of plantMachines) {
            if (item.machine_id) {
                const match = item.machine_id.match(/^M(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        }

        this.machine_id = `M${maxNumber + 1}`;
    }
});

// Compound unique indexes
machineSchema.index({ plant_id: 1, machine_id: 1 }, { unique: true });
machineSchema.index({ plant_id: 1, machine_ip: 1 }, { unique: true });
machineSchema.index({ plant_id: 1, machine_liscence: 1 }, { unique: true });
machineSchema.index({ plant_id: 1 });
machineSchema.index({ plant_id: 1, department_id: 1 });

const MachineModel = mongoose.model('machines', machineSchema);

module.exports = MachineModel;
