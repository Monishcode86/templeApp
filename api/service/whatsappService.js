const path = require('path');
const logger = require('../config/logger');

let makeWASocket = null;
let useMultiFileAuthState = null;
let DisconnectReason = null;
let qrcode = null;

try {
    const baileys = require('@whiskeysockets/baileys');
    makeWASocket = baileys.makeWASocket || baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    qrcode = require('qrcode-terminal');
} catch (err) {
    logger.warn(`[Baileys Loader]: ${err.message}`);
}

// In-memory message store for encryption retries
const messageStore = new Map();

// In-memory Baileys client singleton
let sock = null;
let isConnecting = false;
let qrCodeString = null;
let connectionState = 'DISCONNECTED'; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'QR_READY'

/**
 * Clean and format recipient phone number to international E.164 without '+'
 * e.g., '+91 98765 43210' -> '919876543210'
 */
const formatPhoneNumber = (countryCode = '+91', mobileNumber = '') => {
    const rawNumber = String(mobileNumber || '').trim();
    if (!rawNumber) return null;

    // Remove all non-digits
    const cleanDigits = rawNumber.replace(/\D/g, '');
    const cleanCountry = String(countryCode || '+91').replace(/\D/g, '');

    // If number already starts with country code
    if (cleanDigits.startsWith(cleanCountry)) {
        return cleanDigits;
    }
    return `${cleanCountry}${cleanDigits}`;
};

/**
 * Generate standard donation confirmation message
 */
const buildDonationMessage = ({ username, amount, type, remarks, date, donationId }) => {
    const formattedAmount = '₹' + Number(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const displayDate = date
        ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let msg = `🙏 *Donation Receipt Confirmation*\n\n`;
    msg += `Dear *${username || 'Donor'}*,\n`;
    msg += `Thank you for your generous contribution!\n\n`;
    msg += `💳 *Amount:* ${formattedAmount}\n`;
    msg += `📝 *Payment Method:* ${type || 'Direct'}\n`;
    msg += `📅 *Date:* ${displayDate}\n`;
    if (remarks) {
        msg += `💬 *Remarks:* ${remarks}\n`;
    }
    if (donationId) {
        msg += `🔖 *Receipt Reference:* ${donationId}\n`;
    }
    msg += `\nYour generosity is deeply appreciated. May your kindness bring joy and blessing.`;

    return msg;
};

/**
 * Initialize Baileys WhatsApp Web Client for Local Development (MIT License)
 */
const initBaileys = async () => {
    if (process.env.NODE_ENV === 'production' && process.env.WHATSAPP_PROVIDER !== 'local') {
        return null;
    }

    if (!makeWASocket || !useMultiFileAuthState) {
        logger.warn('[Baileys] Module not loaded, skipping Baileys initialization.');
        return null;
    }

    if (sock && connectionState === 'CONNECTED') {
        return sock;
    }

    if (isConnecting) {
        return sock;
    }

    isConnecting = true;
    connectionState = 'CONNECTING';

    try {
        const authPath = path.join(__dirname, '..', '.baileys_auth');
        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        const silentLogger = {
            level: 'silent',
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            child() { return this; }
        };

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: silentLogger,
            getMessage: async (key) => {
                return messageStore.get(key.id) || undefined;
            }
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCodeString = qr;
                connectionState = 'QR_READY';
                console.log('\n============================================================');
                console.log('📱 SCAN THIS QR CODE IN WHATSAPP TO LINK FOR LOCAL TESTING:');
                console.log('   (WhatsApp -> Settings -> Linked Devices -> Link a Device)');
                console.log('============================================================\n');
                if (qrcode) {
                    qrcode.generate(qr, { small: true });
                }
                console.log('\n============================================================\n');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;
                logger.warn(`[Baileys] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);
                connectionState = 'DISCONNECTED';
                sock = null;
                isConnecting = false;
                if (shouldReconnect) {
                    setTimeout(() => initBaileys(), 6000);
                }
            } else if (connection === 'open') {
                connectionState = 'CONNECTED';
                qrCodeString = null;
                isConnecting = false;
                const userJid = sock.user?.id || 'Connected Device';
                console.log(`\n✅ [Baileys] WhatsApp connected successfully as: ${userJid}\n`);
                logger.info(`[Baileys] WhatsApp connected successfully as: ${userJid}`);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        isConnecting = false;
        return sock;
    } catch (err) {
        isConnecting = false;
        connectionState = 'DISCONNECTED';
        logger.error(`[Baileys] Init error: ${err.message}`);
        return null;
    }
};

// Auto-start Baileys in local development mode
if (process.env.NODE_ENV !== 'production' || process.env.WHATSAPP_PROVIDER === 'local') {
    setTimeout(() => {
        initBaileys().catch((err) => logger.error(`[Baileys AutoStart]: ${err.message}`));
    }, 2000);
}

/**
 * Send WhatsApp message using Meta WhatsApp Business Cloud API (Production)
 */
const sendViaWhatsAppBusiness = async (recipientPhone, messageText) => {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
        throw new Error(
            'WhatsApp Business Cloud API credentials not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env.'
        );
    }

    const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: {
            preview_url: false,
            body: messageText
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        const errorDetail = data?.error?.message || `WhatsApp Business API error (HTTP ${response.status})`;
        logger.error(`WhatsApp Business API failure: ${errorDetail}`, { response: data });
        throw new Error(errorDetail);
    }

    const messageId = data?.messages?.[0]?.id || `wamid.prod_${Date.now()}`;
    logger.info(`WhatsApp message sent successfully via Business API to ${recipientPhone} [ID: ${messageId}]`);

    return {
        provider: 'WhatsApp Business Cloud API',
        messageId,
        recipient: recipientPhone,
        status: 'DELIVERED'
    };
};

/**
 * Send WhatsApp message using Baileys local multi-device connection (MIT package)
 */
const sendViaBaileys = async (recipientPhone, messageText) => {
    // If not connected yet, try connecting
    if (!sock || connectionState !== 'CONNECTED') {
        await initBaileys();
    }

    // If still not connected
    if (!sock || connectionState !== 'CONNECTED') {
        const directWebLink = `https://web.whatsapp.com/send?phone=${recipientPhone}&text=${encodeURIComponent(messageText)}`;
        const errMessage = qrCodeString
            ? 'WhatsApp is not linked yet. Please scan the QR code printed in the backend terminal (WhatsApp -> Linked Devices) or use the direct WhatsApp link.'
            : 'WhatsApp client is initializing. Please check the backend terminal for the QR code or try again shortly.';

        const error = new Error(errMessage);
        error.directWebLink = directWebLink;
        error.qrCode = qrCodeString;
        throw error;
    }

    // Determine canonical JID
    let targetJid = `${recipientPhone}@s.whatsapp.net`;

    // Check if sending to the bot's own linked WhatsApp number
    const botUser = sock.user?.id || '';
    const botPhone = botUser.split(':')[0]?.replace(/\D/g, '') || botUser.split('@')[0]?.replace(/\D/g, '');
    const isSelfMessage = Boolean(botPhone && botPhone === recipientPhone);

    if (isSelfMessage) {
        // When sending to the linked account itself, use primary clean JID
        targetJid = `${botPhone}@s.whatsapp.net`;
        logger.info(`[Baileys] Sending to linked account's self-chat ("You"): ${targetJid}`);
    } else {
        // Query WhatsApp server to verify registration and get canonical JID
        try {
            const results = await sock.onWhatsApp(recipientPhone);
            if (results && results.length > 0) {
                if (results[0].exists) {
                    targetJid = results[0].jid;
                } else {
                    throw new Error(`The phone number +${recipientPhone} is not registered on WhatsApp.`);
                }
            }
        } catch (onWaErr) {
            if (onWaErr.message.includes('not registered')) {
                throw onWaErr;
            }
            logger.warn(`[Baileys onWhatsApp check]: ${onWaErr.message}`);
        }
    }

    const sent = await sock.sendMessage(targetJid, { text: messageText });
    if (sent?.message && sent?.key?.id) {
        messageStore.set(sent.key.id, sent.message);
    }

    logger.info(`[Baileys] Real WhatsApp message sent to ${recipientPhone} (JID: ${targetJid}) [ID: ${sent?.key?.id}]`);

    return {
        provider: '@whiskeysockets/baileys (MIT)',
        messageId: sent?.key?.id || `wamid.baileys_${Date.now()}`,
        recipient: recipientPhone,
        status: 'DELIVERED',
        dispatchedAt: new Date().toISOString()
    };
};

/**
 * Unified dispatch: Automatically switches between Business API (Production) and Baileys (Local Development)
 */
const sendWhatsAppMessage = async ({ countryCode, mobileNumber, messageText }) => {
    const formattedPhone = formatPhoneNumber(countryCode, mobileNumber);

    if (!formattedPhone) {
        throw new Error('Valid mobile phone number is required to send WhatsApp notification.');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const provider = (process.env.WHATSAPP_PROVIDER || (isProduction ? 'business' : 'local')).toLowerCase();

    if (provider === 'business' || provider === 'cloud_api' || (isProduction && provider !== 'local')) {
        return await sendViaWhatsAppBusiness(formattedPhone, messageText);
    } else {
        return await sendViaBaileys(formattedPhone, messageText);
    }
};

/**
 * Get current WhatsApp connection status
 */
const getWhatsAppStatus = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const provider = (process.env.WHATSAPP_PROVIDER || (isProduction ? 'business' : 'local')).toLowerCase();

    if (provider === 'business' || provider === 'cloud_api' || (isProduction && provider !== 'local')) {
        return {
            provider: 'business',
            status: 'CONFIGURED',
            connectedPhone: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'Configured Cloud API' : 'Credentials Missing'
        };
    }

    return {
        provider: 'baileys',
        status: connectionState,
        connectedPhone: sock?.user?.id || null,
        hasQr: !!qrCodeString,
        qr: qrCodeString
    };
};

module.exports = {
    formatPhoneNumber,
    buildDonationMessage,
    sendWhatsAppMessage,
    getWhatsAppStatus,
    initBaileys
};
