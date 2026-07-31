const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");
const {
    generateOtp,
    hashValue,
    safeHashCompare,
    deliverOtp
} = require("../utils/otpService");

const router = express.Router();

const OTP_EXPIRY_MINUTES = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many OTP requests. Please try again after 15 minutes."
    }
});

const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many verification attempts. Please try again later."
    }
});

function normalizeEmail(email = "") {
    return String(email).trim().toLowerCase();
}

function normalizePhone(phone = "") {
    const value = String(phone).trim();
    const hasLeadingPlus = value.startsWith("+");
    const digits = value.replace(/\D/g, "");
    return hasLeadingPlus ? `+${digits}` : digits;
}

function phoneCandidates(phone = "") {
    const normalized = normalizePhone(phone);
    const digits = normalized.replace(/\D/g, "");
    const candidates = new Set([String(phone).trim(), normalized, digits]);

    // Match an Indian number whether it was saved as 10 digits or +91XXXXXXXXXX.
    if (digits.length === 10) {
        candidates.add(`+91${digits}`);
        candidates.add(`91${digits}`);
    } else if (digits.length === 12 && digits.startsWith("91")) {
        candidates.add(digits.slice(2));
        candidates.add(`+${digits}`);
    }

    return [...candidates].filter(Boolean);
}

function toSmsPhone(phone = "") {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (String(phone).trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
        return `+${digits}`;
    }
    return "";
}

function isEmail(value = "") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

async function findUserByIdentifier(identifier, includeResetFields = false) {
    const raw = String(identifier || "").trim();

    if (!raw) {
        return null;
    }

    const query = isEmail(raw)
        ? { email: normalizeEmail(raw) }
        : { phone: { $in: phoneCandidates(raw) } };

    let userQuery = User.findOne(query);

    if (includeResetFields) {
        userQuery = userQuery.select(
            "+passwordResetOtpHash +passwordResetOtpExpiresAt " +
            "+passwordResetOtpAttempts +passwordResetChannel " +
            "+passwordResetTokenHash +passwordResetTokenExpiresAt"
        );
    }

    return userQuery;
}

function clearResetState(user) {
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpAttempts = 0;
    user.passwordResetChannel = undefined;
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpiresAt = undefined;
}

/* Register */
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        if (!name || !email || !password || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name, email, phone number and password are required"
            });
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);

        if (!isEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address" });
        }

        if (normalizedPhone.replace(/\D/g, "").length < 10) {
            return res.status(400).json({ success: false, message: "Please enter a valid phone number" });
        }

        if (String(password).length < 6) {
            return res.status(400).json({ success: false, message: "Password must contain at least 6 characters" });
        }

        const existingUser = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { phone: normalizedPhone },
                { phone: String(phone).trim() }
            ]
        });

        if (existingUser) {
            const duplicateField = existingUser.email === normalizedEmail ? "email address" : "phone number";
            return res.status(409).json({
                success: false,
                message: `An account with this ${duplicateField} already exists`
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name: String(name).trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "customer",
            phone: normalizedPhone
        });

        await user.save();
        return res.status(201).json({ success: true, message: "Registration successful" });
    } catch (err) {
        if (err.code === 11000) {
            const duplicateField = Object.keys(err.keyPattern || {})[0] || "email or phone number";
            return res.status(409).json({
                success: false,
                message: `An account with this ${duplicateField} already exists`
            });
        }

        return res.status(500).json({ success: false, message: "Unable to register user" });
    }
});

/* Login with email or phone */
router.post("/login", async (req, res) => {
    try {
        const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
        const { password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email or phone number and password"
            });
        }

        const user = await findUserByIdentifier(identifier);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: "Invalid email/phone number or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.json({
            success: true,
            token,
            role: user.role,
            name: user.name
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Unable to log in" });
    }
});

/* Request password-reset OTP */
router.post("/forgot-password/request-otp", otpRequestLimiter, async (req, res) => {
    try {
        const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
        const channel = String(req.body.channel || "email").trim().toLowerCase();

        if (!identifier || !["email", "sms"].includes(channel)) {
            return res.status(400).json({
                success: false,
                message: "A registered email/phone number and a valid OTP channel are required"
            });
        }

        const user = await findUserByIdentifier(identifier, true);

        if (!user) {
            return res.json({
                success: true,
                message: "If the account exists, an OTP has been sent."
            });
        }

        let deliveryUser = user;
        if (channel === "sms") {
            const smsPhone = toSmsPhone(user.phone);
            if (!smsPhone) {
                return res.status(400).json({
                    success: false,
                    message: "The saved phone number is invalid. Update it to a valid 10-digit Indian mobile number."
                });
            }
            deliveryUser = { name: user.name, email: user.email, phone: smsPhone };
        }

        const otp = generateOtp();
        user.passwordResetOtpHash = hashValue(otp);
        user.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        user.passwordResetOtpAttempts = 0;
        user.passwordResetChannel = channel;
        user.passwordResetTokenHash = undefined;
        user.passwordResetTokenExpiresAt = undefined;

        const devMode = String(process.env.OTP_DEV_MODE).toLowerCase() === "true";

        // Development mode must work without SMTP or Twilio credentials.
        // In production, OTP delivery is required before the reset state is saved.
        if (!devMode) {
            await deliverOtp(deliveryUser, channel, otp);
        }

        await user.save();

        const response = {
            success: true,
            expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
            message: devMode
                ? `Development OTP created. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
                : `OTP sent through ${channel === "email" ? "email" : "SMS"}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
        };

        if (devMode) {
            response.devOtp = otp;
        }

        return res.json(response);
    } catch (err) {
        console.error("OTP delivery error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Unable to send OTP. Check the email/SMS configuration and try again."
        });
    }
});

/* Verify OTP and issue a one-time reset token */
router.post("/forgot-password/verify-otp", otpVerifyLimiter, async (req, res) => {
    try {
        const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
        const otp = String(req.body.otp || "").trim();

        if (!identifier || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ success: false, message: "Enter a valid 6-digit OTP" });
        }

        const user = await findUserByIdentifier(identifier, true);

        if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
            return res.status(400).json({ success: false, message: "OTP is invalid or no longer active" });
        }

        if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
            clearResetState(user);
            await user.save();
            return res.status(400).json({ success: false, message: "OTP has expired. Request a new OTP." });
        }

        if (user.passwordResetOtpAttempts >= MAX_OTP_ATTEMPTS) {
            clearResetState(user);
            await user.save();
            return res.status(429).json({ success: false, message: "Too many incorrect OTP attempts. Request a new OTP." });
        }

        if (!safeHashCompare(otp, user.passwordResetOtpHash)) {
            user.passwordResetOtpAttempts += 1;
            await user.save();
            return res.status(400).json({
                success: false,
                message: `Incorrect OTP. ${MAX_OTP_ATTEMPTS - user.passwordResetOtpAttempts} attempt(s) remaining.`
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetTokenHash = hashValue(resetToken);
        user.passwordResetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
        user.passwordResetOtpHash = undefined;
        user.passwordResetOtpExpiresAt = undefined;
        user.passwordResetOtpAttempts = 0;

        await user.save();

        return res.json({
            success: true,
            message: "OTP verified. You may now create a new password.",
            resetToken
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Unable to verify OTP" });
    }
});

/* Reset password using the one-time reset token */
router.post("/forgot-password/reset", async (req, res) => {
    try {
        const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
        const resetToken = String(req.body.resetToken || "").trim();
        const newPassword = String(req.body.newPassword || req.body.password || "");

        if (!resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: "Reset token and new password are required" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "Password must contain at least 8 characters" });
        }

        if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must include uppercase, lowercase and a number"
            });
        }

        // Prefer the supplied identifier, but also support older frontend builds
        // that submit only the one-time reset token and the new password.
        const user = identifier
            ? await findUserByIdentifier(identifier, true)
            : await User.findOne({ passwordResetTokenHash: hashValue(resetToken) }).select("+passwordResetTokenHash +passwordResetTokenExpiresAt");

        if (
            !user ||
            !user.passwordResetTokenHash ||
            !user.passwordResetTokenExpiresAt ||
            user.passwordResetTokenExpiresAt.getTime() < Date.now() ||
            !safeHashCompare(resetToken, user.passwordResetTokenHash)
        ) {
            return res.status(400).json({ success: false, message: "Reset session is invalid or expired" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        clearResetState(user);
        await user.save();

        return res.json({ success: true, message: "Password reset successfully. You can now log in." });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Unable to reset password" });
    }
});

module.exports = router;
