const { getalluser } = require('../service/userService');
const commonDao = require('../dao/commonDao');

// Mock commonDao.findAll to test filtering behavior
commonDao.findAll = async ({ query }) => {
    const mockDbUsers = [
        { username: 'admin', email: 'admin@gmail.com', role: 'ADMIN' },
        { username: 'john_doe', email: 'john@gmail.com', role: 'USER' },
        { username: 'jane_doe', email: 'jane@gmail.com', role: 'USER' }
    ];

    if (query?.role?.$ne === 'ADMIN') {
        return mockDbUsers.filter(u => u.role !== 'ADMIN');
    }
    return mockDbUsers;
};

(async () => {
    console.log('--- TESTING ROLE-BASED VISIBILITY ---');

    // 1. Admin caller
    const adminView = await getalluser({ role: 'ADMIN' });
    console.log('Admin caller sees count:', adminView.length, adminView.map(u => `${u.username}(${u.role})`));
    const adminHasAdmin = adminView.some(u => u.role === 'ADMIN');
    console.log('Admin view contains ADMIN user:', adminHasAdmin);

    // 2. Non-admin caller (e.g. role: 'USER')
    const userView = await getalluser({ role: 'USER' });
    console.log('User caller sees count:', userView.length, userView.map(u => `${u.username}(${u.role})`));
    const userHasAdmin = userView.some(u => u.role === 'ADMIN');
    console.log('User view contains ADMIN user:', userHasAdmin);

    if (adminHasAdmin && !userHasAdmin) {
        console.log('\nSUCCESS: Role-based filtering verified! Non-admin users are strictly prohibited from viewing admin users.');
        process.exit(0);
    } else {
        console.error('FAILED: Role-based filtering failed.');
        process.exit(1);
    }
})();
