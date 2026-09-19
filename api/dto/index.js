const UserModel = require('../model/userModel');
const PlantModel = require('../model/plantModel');
const ShiftModel = require('../model/shiftModel');
const DepartmentModel = require('../model/departmentModel');

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
    DepartmentModel: DepartmentModel
};

module.exports = schema;
