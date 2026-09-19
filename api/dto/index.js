const UserModel = require('../model/userModel');
const PlantModel = require('../model/plantModel');
const ShiftModel = require('../model/shiftModel');
const DepartmentModel = require('../model/departmentModel');
const PartModel = require('../model/partModel');
const DowntimeModel = require('../model/downtimeModel');
const MachineTypeModel = require('../model/machineTypeModel');
const MachineModel = require('../model/machineModel');

const schema = {
    users: UserModel,
    user: UserModel,
    UserModel: UserModel,
    plants: PlantModel,
    plant: PlantModel,
    PlantModel: PlantModel,
    shifts: ShiftModel,
    shift: ShiftModel,
    ShiftModel: ShiftModel,
    departments: DepartmentModel,
    department: DepartmentModel,
    DepartmentModel: DepartmentModel,
    parts: PartModel,
    part: PartModel,
    PartModel: PartModel,
    downtimes: DowntimeModel,
    downtime: DowntimeModel,
    DowntimeModel: DowntimeModel,
    machinetypes: MachineTypeModel,
    machinetype: MachineTypeModel,
    MachineTypeModel: MachineTypeModel,
    machines: MachineModel,
    machine: MachineModel,
    MachineModel: MachineModel
};

module.exports = schema;
