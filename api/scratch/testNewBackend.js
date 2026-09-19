require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { initDB, closeDB } = require('../db/db');
const { login } = require('../service/authService');
const { addPlant, getAllPlants } = require('../service/plantService');
const { adduser, getalluser, updateuser, deleteuser } = require('../service/userService');

async function test() {
    try {
        console.log('Connecting to MongoDB...');
        await initDB();
        console.log('DB connected and initialized.');

        // 1. Check default plants seeded
        const plantsRes = await getAllPlants();
        console.log(`Plants in DB: ${plantsRes.data.length}`);
        console.log('Sample plant:', plantsRes.data[0]?.plant_name, plantsRes.data[0]?.plant_id);

        // 2. Test admin login via email
        const adminLogin = await login({ email: 'admin@gmail.com', password: process.env.adminUserPasssword || 'Admin@12345' });
        console.log('Admin login with email OK:', adminLogin.user.email, adminLogin.user.role);

        // 3. Test creating a user with employee_id, plant_id, plant_name, and image
        const testEmpId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
        const testEmail = `user.${Date.now()}@test.com`;
        const newUser = await adduser({
            username: 'John Doe',
            email: testEmail,
            password: 'Password@123',
            role: 'USER',
            employee_id: testEmpId,
            image: '/uploads/users/sample.png',
            plant_id: plantsRes.data[0]?.plant_id || 'PLANT-001',
            plant_name: plantsRes.data[0]?.plant_name || 'Main Manufacturing Facility'
        });
        console.log('New user created OK:', newUser.email, 'EmpID:', newUser.employee_id, 'Plant:', newUser.plant_name);

        // 4. Test login using Employee ID!
        const empLogin = await login({ identifier: testEmpId, password: 'Password@123' });
        console.log('Employee ID login OK! Authenticated user:', empLogin.user.email, 'EmpID:', empLogin.user.employee_id);

        // 5. Test search by employee_id
        const searchRes = await getalluser({ search: testEmpId }, { role: 'ADMIN' });
        console.log('Search by employee ID found:', searchRes.data.length, 'matches. Match email:', searchRes.data[0]?.email);

        // 6. Test search by plant_name
        const searchPlant = await getalluser({ search: plantsRes.data[0]?.plant_name?.slice(0, 5) }, { role: 'ADMIN' });
        console.log('Search by plant name found:', searchPlant.data.length, 'matches.');

        // 7. Cleanup test user
        await deleteuser(newUser._id);
        console.log('Test user cleaned up OK.');

        await closeDB();
        console.log('ALL BACKEND TESTS PASSED!');
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

test();
