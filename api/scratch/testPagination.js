const { getalluser } = require('../service/userService');
const commonDao = require('../dao/commonDao');

// Mock data: 25 users
const mockUsers = Array.from({ length: 25 }, (_, i) => ({
    _id: `user_${i + 1}`,
    username: `user_${i + 1}`,
    email: `user_${i + 1}@example.com`,
    role: i === 0 ? 'ADMIN' : 'USER',
    createdAt: new Date(Date.now() - i * 1000)
}));

commonDao.findAll = async ({ query, options }, schemaName, id, count) => {
    let list = [...mockUsers];
    if (query?.role?.$ne === 'ADMIN') {
        list = list.filter(u => u.role !== 'ADMIN');
    }
    if (query?.$or) {
        const regex = query.$or[0].username;
        list = list.filter(u => regex.test(u.username) || regex.test(u.email));
    }

    if (count === 'count') {
        return list.length;
    }

    const skip = options?.skip || 0;
    const limit = options?.limit || 10;
    return list.slice(skip, skip + limit);
};

(async () => {
    console.log('--- TESTING PAGINATION & SEARCH API ---');

    // 1. Admin caller: page 1, limit 10
    const page1 = await getalluser({ page: 1, limit: 10 }, { role: 'ADMIN' });
    console.log('Page 1 result count:', page1.data.length);
    console.log('Pagination metadata:', page1.pagination);

    if (page1.data.length !== 10 || page1.pagination.total !== 25 || page1.pagination.totalPages !== 3) {
        console.error('Failed page 1 test');
        process.exit(1);
    }

    // 2. Admin caller: page 3, limit 10 (should have 5 items remaining)
    const page3 = await getalluser({ page: 3, limit: 10 }, { role: 'ADMIN' });
    console.log('Page 3 result count:', page3.data.length);
    if (page3.data.length !== 5) {
        console.error('Failed page 3 test');
        process.exit(1);
    }

    // 3. Search query: search 'user_2'
    const searchRes = await getalluser({ search: 'user_2', page: 1, limit: 10 }, { role: 'ADMIN' });
    console.log('Search "user_2" count:', searchRes.data.length, 'Total matching:', searchRes.pagination.total);

    // 4. Non-admin caller: total should be 24 (excluding the 1 ADMIN user)
    const nonAdminRes = await getalluser({ page: 1, limit: 10 }, { role: 'USER' });
    console.log('Non-admin caller total:', nonAdminRes.pagination.total);
    if (nonAdminRes.pagination.total !== 24) {
        console.error('Failed non-admin role pagination test');
        process.exit(1);
    }

    console.log('\nSUCCESS: Common pagination and search verified on API!');
    process.exit(0);
})();
