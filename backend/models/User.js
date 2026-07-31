const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["customer", "provider", "admin"],
            default: "customer"
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        available: {
            type: Boolean,
            default: true
        },

        skills: [{ type: String, trim: true }],

        experienceYears: { type: Number, min: 0, max: 60, default: 0 },

        workerVerification: {
            status: { type: String, enum: ["Not Submitted", "Pending", "Verified", "Rejected"], default: "Not Submitted" },
            governmentIdType: { type: String, enum: ["", "Aadhaar", "PAN", "Driving Licence", "Voter ID", "Passport"], default: "" },
            governmentIdLast4: { type: String, trim: true, maxlength: 4, default: "" },
            certifications: [{ type: String, trim: true }],
            backgroundCheck: { type: String, enum: ["Not Started", "Pending", "Cleared", "Failed"], default: "Not Started" },
            adminNote: { type: String, trim: true, maxlength: 500, default: "" },
            reviewedAt: { type: Date, default: null },
            reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
        },

        isActive: {
            type: Boolean,
            default: true
        },

        passwordResetOtpHash: {
            type: String,
            select: false
        },

        passwordResetOtpExpiresAt: {
            type: Date,
            select: false
        },

        passwordResetOtpAttempts: {
            type: Number,
            default: 0,
            select: false
        },

        passwordResetChannel: {
            type: String,
            enum: ["email", "sms"],
            select: false
        },

        passwordResetTokenHash: {
            type: String,
            select: false
        },

        passwordResetTokenExpiresAt: {
            type: Date,
            select: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
