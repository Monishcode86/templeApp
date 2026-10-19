const express = require('express');
const {
    addDonationController,
    getAllDonationsController,
    getDonationController,
    updateDonationController,
    deleteDonationController
} = require('../controller/donationController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// All donation endpoints require authentication
router.use(authenticateToken);

// Record donation restricted to ADMIN
router.post('/', authorizeRoles('ADMIN'), addDonationController);
router.get('/', getAllDonationsController);
router.get('/:id', getDonationController);
router.put('/:id', updateDonationController);
router.delete('/:id', deleteDonationController);

module.exports = router;
