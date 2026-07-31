const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(

    {

        customer: {

            type: mongoose.Schema.Types.ObjectId,

            ref: "User",

            required: true

        },

        provider: {

            type: mongoose.Schema.Types.ObjectId,

            ref: "User",

            default: null

        },

        service: {

            type: mongoose.Schema.Types.ObjectId,

            ref: "Service",

            required: true

        },

        bookingDate: {

            type: Date,

            required: true

        },

        timeSlot: {

            type: String,

            trim: true

        },

        address: {

            type: String,

            required: true

        },

        emergency: {

            type: Boolean,

            default: false

        },

        notes: {

            type: String,

            trim: true,

            maxlength: 200,

            default: ""

        },

        bookingCode: {

            type: String,

            unique: true,

            sparse: true

        },

        pricing: {

            base: { type: Number, default: 0 },

            visit: { type: Number, default: 49 },

            emergency: { type: Number, default: 0 },

            tax: { type: Number, default: 0 },

            discount: { type: Number, default: 0 },

            couponCode: { type: String, trim: true, uppercase: true, default: "" },

            total: { type: Number, default: 0 }

        },

        customerLocation: {
            latitude: { type: Number, min: -90, max: 90 },
            longitude: { type: Number, min: -180, max: 180 },
            accuracy: { type: Number, default: null },
            capturedAt: { type: Date, default: null },
            addressLabel: { type: String, trim: true, maxlength: 300, default: "" }
        },

        providerLocation: {
            latitude: { type: Number, min: -90, max: 90 },
            longitude: { type: Number, min: -180, max: 180 },
            accuracy: { type: Number, default: null },
            updatedAt: { type: Date, default: null },
            sharing: { type: Boolean, default: false }
        },

        payment: {
            status: { type: String, enum: ["Unpaid", "Pending Verification", "Paid", "Rejected"], default: "Unpaid" },
            method: { type: String, enum: ["UPI QR", "Cash on Delivery"], default: "UPI QR" },
            paidAt: { type: Date, default: null },
            transactionRef: { type: String, trim: true, maxlength: 80, default: "" },
            verificationSource: { type: String, enum: ["", "Admin", "Worker Cash", "Worker UPI", "Razorpay Webhook"], default: "" },
            claimedAt: { type: Date, default: null },
            gatewayPaymentId: { type: String, trim: true, default: "" },
            gatewayOrderId: { type: String, trim: true, default: "" }
        },

        status: {

            type: String,

            enum: [

                "Pending",

                "Accepted",

                "On the Way",

                "Completed",

                "Cancelled"

            ],

            default: "Pending"

        },

        statusHistory: [{
            status: { type: String, enum: ["Pending", "Accepted", "On the Way", "Completed", "Cancelled"] },
            changedAt: { type: Date, default: Date.now },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
        }]

    },

    {

        timestamps: true

    }

);

module.exports = mongoose.model("Booking", bookingSchema);