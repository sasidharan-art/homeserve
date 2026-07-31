const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

// ===================================
// OTP generation and hashing
// ===================================

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

function hashValue(value) {
    const secret =
        process.env.OTP_HASH_SECRET ||
        process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            "OTP_HASH_SECRET or JWT_SECRET must be configured"
        );
    }

    return crypto
        .createHmac("sha256", secret)
        .update(String(value))
        .digest("hex");
}

function safeHashCompare(plainValue, storedHash) {
    if (!plainValue || !storedHash) {
        return false;
    }

    const suppliedHash = hashValue(plainValue);

    const suppliedBuffer = Buffer.from(suppliedHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    return (
        suppliedBuffer.length === storedBuffer.length &&
        crypto.timingSafeEqual(suppliedBuffer, storedBuffer)
    );
}

// ===================================
// Email configuration
// ===================================

function createEmailTransporter() {
    const emailUser =
        process.env.EMAIL_USER ||
        process.env.SMTP_USER;

    const emailPass =
        process.env.EMAIL_PASS ||
        process.env.SMTP_PASS;

    if (!emailUser || !emailPass) {
        throw new Error(
            "EMAIL_USER and EMAIL_PASS are required"
        );
    }

    const host =
        process.env.EMAIL_HOST ||
        process.env.SMTP_HOST ||
        "smtp.gmail.com";

    const port = Number(
        process.env.EMAIL_PORT ||
        process.env.SMTP_PORT ||
        587
    );

    const secureValue =
        process.env.EMAIL_SECURE ??
        process.env.SMTP_SECURE;

    const secure =
        secureValue !== undefined
            ? String(secureValue).toLowerCase() === "true"
            : port === 465;

    return nodemailer.createTransport({
        host,
        port,
        secure,

        auth: {
            user: emailUser,
            pass: emailPass
        },

        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,

        tls: {
            rejectUnauthorized: true
        }
    });
}

// ===================================
// Send Email OTP
// ===================================

async function sendEmailOtp(user, otp) {
    if (!user?.email) {
        throw new Error(
            "The user does not have a registered email address"
        );
    }

    const transporter = createEmailTransporter();

    const senderEmail =
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        process.env.SMTP_USER;

    // Verify SMTP before attempting delivery.
    await transporter.verify();

    const info = await transporter.sendMail({
        from: `HomeServe <${senderEmail}>`,
        to: user.email,
        subject: "HomeServe password reset OTP",

        text:
            `Hello ${user.name || "User"},\n\n` +
            `Your HomeServe password reset OTP is ${otp}.\n` +
            "It expires in 10 minutes.\n\n" +
            "Do not share this OTP with anyone.",

        html: `
            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 520px;
                    margin: auto;
                    padding: 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                "
            >
                <h2 style="margin-top: 0;">
                    HomeServe password reset
                </h2>

                <p>Hello ${user.name || "User"},</p>

                <p>
                    Use the following one-time password to reset
                    your account password:
                </p>

                <p
                    style="
                        font-size: 32px;
                        font-weight: 700;
                        letter-spacing: 8px;
                        margin: 24px 0;
                    "
                >
                    ${otp}
                </p>

                <p>
                    This OTP expires in 10 minutes.
                    Do not share it with anyone.
                </p>
            </div>
        `
    });

    console.log(
        `Email OTP sent to ${user.email}. Message ID: ${info.messageId}`
    );
}

// ===================================
// Send SMS OTP
// ===================================

async function sendSmsOtp(user, otp) {
    const {
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER
    } = process.env;

    if (
        !TWILIO_ACCOUNT_SID ||
        !TWILIO_AUTH_TOKEN ||
        !TWILIO_PHONE_NUMBER
    ) {
        throw new Error(
            "Twilio SMS service is not configured"
        );
    }

    if (!user?.phone) {
        throw new Error(
            "The user does not have a registered phone number"
        );
    }

    const client = twilio(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN
    );

    const message = await client.messages.create({
        body:
            `Your HomeServe password reset OTP is ${otp}. ` +
            "It expires in 10 minutes.",
        from: TWILIO_PHONE_NUMBER,
        to: user.phone
    });

    console.log(
        `SMS OTP sent to ${user.phone}. SID: ${message.sid}`
    );
}

// ===================================
// Deliver OTP
// ===================================

async function deliverOtp(user, channel, otp) {
    const selectedChannel =
        String(channel || "").trim().toLowerCase();

    if (selectedChannel === "email") {
        await sendEmailOtp(user, otp);
        return;
    }

    if (selectedChannel === "sms") {
        await sendSmsOtp(user, otp);
        return;
    }

    throw new Error("Unsupported OTP channel");
}

module.exports = {
    generateOtp,
    hashValue,
    safeHashCompare,
    deliverOtp
};