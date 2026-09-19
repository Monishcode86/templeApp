const UserModel = require('../model/userModel');
const PlantModel = require('../model/plantModel');
const ShiftModel = require('../model/shiftModel');
const DepartmentModel = require('../model/departmentModel');
const PartModel = require('../model/partModel');

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
    PartModel: PartModel
};

module.exports = schema;
