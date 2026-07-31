const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

function hashValue(value) {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("OTP_HASH_SECRET or JWT_SECRET must be configured");
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

    return suppliedBuffer.length === storedBuffer.length &&
        crypto.timingSafeEqual(suppliedBuffer, storedBuffer);
}

function createEmailTransporter() {
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    throw new Error("Email service is not configured");
}

async function sendEmailOtp(user, otp) {
    const transporter = createEmailTransporter();
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;

    await transporter.sendMail({
        from: `HomeServe <${from}>`,
        to: user.email,
        subject: "HomeServe password reset OTP",
        text: `Your HomeServe password reset OTP is ${otp}. It expires in 10 minutes. Do not share it with anyone.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
                <h2 style="margin-top:0">HomeServe password reset</h2>
                <p>Hello ${user.name},</p>
                <p>Use the following one-time password to reset your account password:</p>
                <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${otp}</p>
                <p>This OTP expires in 10 minutes. Do not share it with anyone.</p>
            </div>
        `
    });
}

async function sendSmsOtp(user, otp) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        throw new Error("Twilio SMS service is not configured");
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    await client.messages.create({
        body: `Your HomeServe password reset OTP is ${otp}. It expires in 10 minutes.`,
        from: TWILIO_PHONE_NUMBER,
        to: user.phone
    });
}

async function deliverOtp(user, channel, otp) {
    if (channel === "email") {
        await sendEmailOtp(user, otp);
        return;
    }

    if (channel === "sms") {
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
