const mongoose = require('mongoose');
const commonDao = require('../dao/commonDao');
const logger = require('../config/logger');
const {
    buildDonationMessage,
    sendWhatsAppMessage,
    getWhatsAppStatus,
    initBaileys
} = require('./whatsappService');

const DONATION_SCHEMA = 'donations';
const USER_SCHEMA = 'users';
const FAILED_NOTIF_SCHEMA = 'failed_notifications';

// Timeout for stale processing lock (2 minutes)
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Get all donations pending WhatsApp notification (whatsapp_send: false)
 * Enriched with user mobile number and country code
 */
const getPendingNotifications = async (params = {}, currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only administrators can view notification queue.');
        error.statusCode = 403;
        throw error;
    }

    const conditions = [{ whatsapp_send: false }];

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        conditions.push({
            $or: [
                { user_id: searchRegex },
                { username: searchRegex },
                { type: searchRegex },
                { remarks: searchRegex }
            ]
        });
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));

    const result = await commonDao.findWithPagination(
        { query, page, limit, sort: { date: -1, createdAt: -1 } },
        DONATION_SCHEMA
    );

    // Enrich with user phone information
    const donations = result.data || [];
    const enriched = await Promise.all(
        donations.map(async (don) => {
            const donObj = don.toObject ? don.toObject() : { ...don };
            const trimmedUserId = String(donObj.user_id || '').trim();

            const orConditions = [{ user_id: trimmedUserId }];
            if (mongoose.Types.ObjectId.isValid(trimmedUserId)) {
                orConditions.push({ _id: trimmedUserId });
            }

            const user = await commonDao.findOneData(
                { query: orConditions.length > 1 ? { $or: orConditions } : orConditions[0] },
                USER_SCHEMA
            );

            donObj.mobile_number = user?.mobile_number || null;
            donObj.country_code = user?.country_code || '+91';
            donObj.has_valid_mobile = !!(user?.mobile_number && String(user.mobile_number).trim().length >= 7);
            return donObj;
        })
    );

    return {
        data: enriched,
        pagination: result.pagination
    };
};

/**
 * Trigger WhatsApp notification for a specific donation with concurrency lock
 */
const sendDonationNotification = async (donationId, currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only administrators can send WhatsApp notifications.');
        error.statusCode = 403;
        throw error;
    }

    if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
        const error = new Error('Invalid donation ID provided.');
        error.statusCode = 400;
        throw error;
    }

    // Atomic lock to guarantee NO duplicate message is ever sent
    let donation = await commonDao.findOneAndUpdate(
        {
            filter: {
                _id: donationId,
                whatsapp_send: false,
                whatsapp_processing: { $ne: true }
            },
            update: {
                $set: {
                    whatsapp_processing: true,
                    whatsapp_processing_at: new Date()
                }
            },
            options: { returnDocument: 'after' }
        },
        DONATION_SCHEMA
    );

    // If lock was not acquired, check why
    if (!donation) {
        const existing = await commonDao.findOneData({ query: { _id: donationId } }, DONATION_SCHEMA);

        if (!existing) {
            const error = new Error(`Donation with ID '${donationId}' not found.`);
            error.statusCode = 404;
            throw error;
        }

        if (existing.whatsapp_send) {
            return {
                status: 'ALREADY_SENT',
                message: 'WhatsApp notification has already been sent for this donation.',
                donation: existing
            };
        }

        // Check if locked is stale (> 2 mins)
        const lockAge = existing.whatsapp_processing_at ? (Date.now() - new Date(existing.whatsapp_processing_at).getTime()) : 0;
        if (existing.whatsapp_processing && lockAge > LOCK_TIMEOUT_MS) {
            logger.warn(`Breaking stale lock on donation ${donationId} (age: ${lockAge}ms)`);
            donation = await commonDao.findOneAndUpdate(
                {
                    filter: { _id: donationId },
                    update: {
                        $set: {
                            whatsapp_processing: true,
                            whatsapp_processing_at: new Date()
                        }
                    },
                    options: { returnDocument: 'after' }
                },
                DONATION_SCHEMA
            );
        } else {
            return {
                status: 'IN_PROGRESS',
                message: 'A WhatsApp notification dispatch is currently in progress for this donation. Please wait.'
            };
        }
    }

    // Lookup user to get recipient phone number
    const trimmedUserId = String(donation.user_id || '').trim();
    const orConditions = [{ user_id: trimmedUserId }];
    if (mongoose.Types.ObjectId.isValid(trimmedUserId)) {
        orConditions.push({ _id: trimmedUserId });
    }

    const user = await commonDao.findOneData(
        { query: orConditions.length > 1 ? { $or: orConditions } : orConditions[0] },
        USER_SCHEMA
    );

    const countryCode = user?.country_code || '+91';
    const mobileNumber = user?.mobile_number;

    const messageText = buildDonationMessage({
        username: donation.username || user?.username,
        amount: donation.amount,
        type: donation.type,
        remarks: donation.remarks,
        date: donation.date || donation.createdAt,
        donationId: donation._id
    });

    try {
        if (!mobileNumber || !String(mobileNumber).trim()) {
            throw new Error(`User '${donation.username || donation.user_id}' does not have a registered mobile number.`);
        }

        // Dispatch via WhatsApp engine (Baileys in dev, Business Cloud API in prod)
        const dispatchResult = await sendWhatsAppMessage({
            countryCode,
            mobileNumber,
            messageText
        });

        // 1. Mark donation as successfully sent & clear processing lock
        await commonDao.updateOne(
            {
                filter: { _id: donation._id },
                update: {
                    $set: {
                        whatsapp_send: true,
                        whatsapp_sent_at: new Date(),
                        whatsapp_processing: false,
                        whatsapp_processing_at: null
                    }
                }
            },
            DONATION_SCHEMA
        );

        // 2. Mark any previous failure as RESOLVED
        await commonDao.updateOne(
            {
                filter: { donation_id: donation._id },
                update: { $set: { status: 'RESOLVED' } }
            },
            FAILED_NOTIF_SCHEMA
        );

        logger.info(`Donation notification sent successfully for donation ${donation._id}`);

        return {
            status: 'SUCCESS',
            message: 'WhatsApp message sent successfully!',
            dispatch: dispatchResult
        };
    } catch (err) {
        logger.error(`Failed to send WhatsApp notification for donation ${donation._id}: ${err.message}`);

        // Unlock donation on failure so it can be retried later
        await commonDao.updateOne(
            {
                filter: { _id: donation._id },
                update: {
                    $set: {
                        whatsapp_processing: false,
                        whatsapp_processing_at: null
                    }
                }
            },
            DONATION_SCHEMA
        );

        // Record failure in failed_notifications table
        const failurePayload = {
            donation_id: donation._id,
            user_id: donation.user_id,
            username: donation.username || user?.username,
            country_code: countryCode,
            mobile_number: mobileNumber || null,
            amount: donation.amount,
            donation_type: donation.type,
            error_message: err.message || 'WhatsApp notification dispatch failed',
            status: 'FAILED',
            failed_at: new Date()
        };

        try {
            await commonDao.insertOne(failurePayload, FAILED_NOTIF_SCHEMA);
        } catch (dbErr) {
            logger.error(`Error saving failure log to DB: ${dbErr.message}`);
        }

        const error = new Error(`WhatsApp delivery failed: ${err.message}`);
        error.statusCode = 400;
        error.directWebLink = err.directWebLink;
        error.qrCode = err.qrCode;
        throw error;
    }
};

/**
 * Parallel Bulk Send: Send notifications for multiple selected donations safely
 */
const sendBulkNotifications = async (donationIds = [], currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only administrators can send WhatsApp notifications.');
        error.statusCode = 403;
        throw error;
    }

    if (!Array.isArray(donationIds) || donationIds.length === 0) {
        const error = new Error('Please select at least one donation to send.');
        error.statusCode = 400;
        throw error;
    }

    logger.info(`Starting bulk notification dispatch for ${donationIds.length} donations...`);

    // Run parallel dispatch with settled results
    const results = await Promise.allSettled(
        donationIds.map(async (id) => {
            try {
                const res = await sendDonationNotification(id, currentUser);
                return { id, status: 'SUCCESS', result: res };
            } catch (err) {
                return { id, status: 'FAILED', error: err.message };
            }
        })
    );

    let successCount = 0;
    let failCount = 0;
    let inProgressCount = 0;

    const summary = results.map((r, index) => {
        const id = donationIds[index];
        if (r.status === 'fulfilled') {
            const val = r.value;
            if (val.status === 'SUCCESS' || val.result?.status === 'SUCCESS') {
                successCount++;
                return { id, status: 'SUCCESS' };
            } else if (val.result?.status === 'IN_PROGRESS') {
                inProgressCount++;
                return { id, status: 'IN_PROGRESS' };
            } else {
                successCount++;
                return { id, status: 'ALREADY_SENT' };
            }
        } else {
            failCount++;
            return { id, status: 'FAILED', error: r.reason?.message || 'Failed' };
        }
    });

    logger.info(`Bulk dispatch complete: ${successCount} successful, ${failCount} failed, ${inProgressCount} in progress.`);

    return {
        total: donationIds.length,
        successful: successCount,
        failed: failCount,
        inProgress: inProgressCount,
        details: summary
    };
};

/**
 * Get all failed notification attempts
 */
const getFailedNotifications = async (params = {}, currentUser) => {
    if (currentUser && currentUser.role !== 'ADMIN') {
        const error = new Error('Forbidden: Only administrators can view failed notifications.');
        error.statusCode = 403;
        throw error;
    }

    const conditions = [{ status: 'FAILED' }];

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
        const searchRegex = new RegExp(params.search.trim(), 'i');
        conditions.push({
            $or: [
                { user_id: searchRegex },
                { username: searchRegex },
                { mobile_number: searchRegex },
                { error_message: searchRegex }
            ]
        });
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));

    return await commonDao.findWithPagination(
        { query, page, limit, sort: { createdAt: -1 } },
        FAILED_NOTIF_SCHEMA
    );
};

module.exports = {
    getPendingNotifications,
    sendDonationNotification,
    sendBulkNotifications,
    getFailedNotifications,
    getWhatsAppConnectionStatus: getWhatsAppStatus,
    initBaileys
};
