const crypto = require("crypto");
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
// Brevo Email API
// ===================================

async function sendEmailOtp(user, otp) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.EMAIL_FROM;
    const senderName = process.env.EMAIL_FROM_NAME || "HomeServe";

    if (!apiKey) {
        throw new Error("BREVO_API_KEY is not configured");
    }

    if (!senderEmail) {
        throw new Error("EMAIL_FROM is not configured");
    }

    if (!user?.email) {
        throw new Error(
            "The user does not have a registered email address"
        );
    }

    const emailPayload = {
        sender: {
            name: senderName,
            email: senderEmail
        },
        to: [
            {
                email: user.email,
                name: user.name || "HomeServe User"
            }
        ],
        subject: "HomeServe password reset OTP",
        textContent:
            `Hello ${user.name || "User"},\n\n` +
            `Your HomeServe password reset OTP is ${otp}.\n` +
            "This OTP expires in 10 minutes.\n\n" +
            "Do not share this OTP with anyone.",
        htmlContent: `
            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 520px;
                    margin: 20px auto;
                    padding: 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    background: #ffffff;
                "
            >
                <h2 style="margin-top: 0; color: #172033;">
                    HomeServe password reset
                </h2>

                <p>Hello ${escapeHtml(user.name || "User")},</p>

                <p>
                    Use the following one-time password to reset
                    your HomeServe account password:
                </p>

                <div
                    style="
                        margin: 24px 0;
                        padding: 18px;
                        border-radius: 10px;
                        background: #f3f7ff;
                        text-align: center;
                    "
                >
                    <span
                        style="
                            font-size: 32px;
                            font-weight: 700;
                            letter-spacing: 8px;
                            color: #1769e0;
                        "
                    >
                        ${otp}
                    </span>
                </div>

                <p>
                    This OTP expires in 10 minutes.
                    Do not share it with anyone.
                </p>

                <p style="color: #64748b; font-size: 13px;">
                    If you did not request a password reset,
                    you can ignore this email.
                </p>
            </div>
        `,
        tags: ["password-reset", "otp"]
    };

    const response = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": apiKey
            },
            body: JSON.stringify(emailPayload),
            signal: AbortSignal.timeout(30000)
        }
    );

    const responseText = await response.text();

    let responseData = {};

    if (responseText) {
        try {
            responseData = JSON.parse(responseText);
        } catch {
            responseData = {
                rawResponse: responseText
            };
        }
    }

    if (!response.ok) {
        console.error("Brevo email API error:", {
            status: response.status,
            statusText: response.statusText,
            response: responseData
        });

        const errorMessage =
            responseData.message ||
            responseData.code ||
            `Brevo email API returned HTTP ${response.status}`;

        throw new Error(errorMessage);
    }

    console.log(
        `Email OTP sent successfully to ${user.email}`,
        {
            messageId: responseData.messageId
        }
    );
}

// ===================================
// SMS OTP using Twilio
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
        `SMS OTP sent successfully to ${user.phone}`,
        {
            sid: message.sid,
            status: message.status
        }
    );
}

// ===================================
// Deliver OTP
// ===================================

async function deliverOtp(user, channel, otp) {
    const selectedChannel = String(channel || "")
        .trim()
        .toLowerCase();

    console.log(
        `OTP delivery requested through: ${selectedChannel}`
    );

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

// ===================================
// Basic HTML escaping
// ===================================

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

module.exports = {
    generateOtp,
    hashValue,
    safeHashCompare,
    deliverOtp
};