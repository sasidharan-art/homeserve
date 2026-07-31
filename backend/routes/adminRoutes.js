const express = require("express");
const User = require("../models/User");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const AppSetting = require("../models/AppSetting");
const auth = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { notify } = require("../utils/notificationService");

const router = express.Router();

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}

router.use(auth, adminOnly);

router.get("/dashboard", async (req, res) => {
    try {
        const [customers, providers, services, bookings, pending, accepted, onTheWay, completed, cancelled] = await Promise.all([
            User.countDocuments({ role: "customer" }),
            User.countDocuments({ role: "provider" }),
            Service.countDocuments(),
            Booking.countDocuments(),
            Booking.countDocuments({ status: "Pending" }),
            Booking.countDocuments({ status: "Accepted" }),
            Booking.countDocuments({ status: "On the Way" }),
            Booking.countDocuments({ status: "Completed" }),
            Booking.countDocuments({ status: "Cancelled" })
        ]);

        const revenueResult = await Booking.aggregate([
            { $match: { status: "Completed" } },
            { $lookup: { from: "services", localField: "service", foreignField: "_id", as: "serviceData" } },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", { $ifNull: ["$serviceData.price", 0] }] } } } }
        ]);

        const recentBookings = await Booking.find()
            .populate("customer", "name email phone")
            .populate("provider", "name")
            .populate("service", "name price category")
            .sort({ createdAt: -1 })
            .limit(8);

        const popularServices = await Booking.aggregate([
            { $group: { _id: "$service", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
            { $unwind: "$service" },
            { $project: { _id: 0, name: "$service.name", count: 1 } }
        ]);

        const monthlyBookings = await Booking.aggregate([
            { $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } } },
            { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        res.json({
            customers, providers, services, bookings, pending, accepted, onTheWay, completed, cancelled,
            revenue: revenueResult[0]?.total || 0,
            recentBookings,
            popularServices,
            monthlyBookings
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.post("/providers", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const phone = String(req.body.phone || "").trim();
        const password = String(req.body.password || "");
        if (!name || !email || !phone || password.length < 8) {
            return res.status(400).json({ message: "Name, email, phone and a temporary password of at least 8 characters are required." });
        }
        const exists = await User.findOne({ $or: [{ email }, { phone }] });
        if (exists) return res.status(409).json({ message: "A user with this email or phone already exists." });
        const provider = await User.create({
            name, email, phone, password: await bcrypt.hash(password, 10), role: "provider",
            skills: Array.isArray(req.body.skills) ? req.body.skills.map(v => String(v).trim()).filter(Boolean) : [],
            experienceYears: Number(req.body.experienceYears || 0), available: true, isActive: true
        });
        res.status(201).json({ message: "Worker account created successfully.", provider: { ...provider.toObject(), password: undefined } });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: "Email or phone already exists." });
        res.status(500).json({ message: err.message });
    }
});

router.patch("/providers/:id", async (req, res) => {
    try {
        const provider = await User.findOne({ _id: req.params.id, role: "provider" });
        if (!provider) return res.status(404).json({ message: "Worker not found." });
        if (req.body.name !== undefined) provider.name = String(req.body.name).trim();
        if (req.body.available !== undefined) provider.available = Boolean(req.body.available);
        if (req.body.skills !== undefined) provider.skills = Array.isArray(req.body.skills) ? req.body.skills.map(v => String(v).trim()).filter(Boolean) : [];
        if (req.body.experienceYears !== undefined) provider.experienceYears = Number(req.body.experienceYears || 0);
        if (req.body.password) {
            if (String(req.body.password).length < 8) return res.status(400).json({ message: "Temporary password must contain at least 8 characters." });
            provider.password = await bcrypt.hash(String(req.body.password), 10);
        }
        await provider.save();
        res.json({ message: "Worker details updated.", provider });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/providers/verification", async (req, res) => {
    try {
        const providers = await User.find({ role: "provider" })
            .select("name email phone skills experienceYears available isActive workerVerification createdAt")
            .sort({ "workerVerification.status": 1, createdAt: -1 });
        res.json(providers);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/providers/:id/verification", async (req, res) => {
    try {
        const provider = await User.findOne({ _id: req.params.id, role: "provider" });
        if (!provider) return res.status(404).json({ message: "Worker not found." });
        const allowedStatus = ["Not Submitted", "Pending", "Verified", "Rejected"];
        const allowedBackground = ["Not Started", "Pending", "Cleared", "Failed"];
        const status = allowedStatus.includes(req.body.status) ? req.body.status : provider.workerVerification?.status || "Not Submitted";
        const backgroundCheck = allowedBackground.includes(req.body.backgroundCheck) ? req.body.backgroundCheck : provider.workerVerification?.backgroundCheck || "Not Started";
        const last4 = String(req.body.governmentIdLast4 || "").replace(/\D/g, "").slice(-4);
        provider.workerVerification = {
            status,
            governmentIdType: String(req.body.governmentIdType || ""),
            governmentIdLast4: last4,
            certifications: Array.isArray(req.body.certifications) ? req.body.certifications.map(v => String(v).trim()).filter(Boolean).slice(0, 20) : [],
            backgroundCheck,
            adminNote: String(req.body.adminNote || "").trim().slice(0, 500),
            reviewedAt: new Date(),
            reviewedBy: req.user.id
        };
        await provider.save();
        await notify({ app:req.app, user:provider._id, title:`Verification ${status}`, message:`Your worker verification status is now ${status.toLowerCase()}.`, type:"account", link:"provider.html" });
        res.json({ message: "Worker verification updated.", provider });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/users", async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch("/users/:id/status", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === "admin") return res.status(400).json({ message: "Admin account cannot be suspended here" });
        user.isActive = Boolean(req.body.isActive);
        await user.save();
        res.json({ message: user.isActive ? "User activated" : "User suspended", user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === "admin") return res.status(400).json({ message: "Admin account cannot be deleted" });
        await Booking.deleteMany({ $or: [{ customer: user._id }, { provider: user._id }] });
        await user.deleteOne();
        res.json({ message: "User and related bookings deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/services", async (req, res) => {
    try {
        res.json(await Service.find().sort({ createdAt: -1 }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/services", async (req, res) => {
    try {
        const service = await Service.create({
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            price: req.body.price
        });
        res.status(201).json({ success: true, message: "Service added successfully", service });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/services/:id", async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(req.params.id, {
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            price: req.body.price
        }, { new: true, runValidators: true });
        if (!service) return res.status(404).json({ message: "Service not found" });
        res.json({ success: true, message: "Service updated successfully", service });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/services/:id", async (req, res) => {
    try {
        const hasBookings = await Booking.exists({ service: req.params.id });
        if (hasBookings) return res.status(409).json({ message: "This service has bookings and cannot be deleted" });
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) return res.status(404).json({ message: "Service not found" });
        res.json({ success: true, message: "Service deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/bookings", async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("customer", "name email phone")
            .populate("provider", "name email phone")
            .populate("service", "name price category")
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch("/bookings/:id", async (req, res) => {
    try {
        const allowedStatuses = ["Pending", "Accepted", "On the Way", "Completed", "Cancelled"];
        const update = {};
        if (req.body.status) {
            if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ message: "Invalid booking status" });
            update.status = req.body.status;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, "provider")) {
            if (req.body.provider) {
                const worker = await User.findOne({ _id: req.body.provider, role: "provider", isActive: { $ne: false } });
                if (!worker) return res.status(400).json({ message: "Select an active provider account." });
                update.provider = worker._id;
                if (!req.body.status) update.status = "Pending";
            } else {
                update.provider = null;
                if (!["Completed", "Cancelled"].includes(req.body.status)) update.status = "Pending";
            }
        }
        const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
            .populate("customer", "name email phone")
            .populate("provider", "name email phone")
            .populate("service", "name price category");
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        req.app.get("io")?.emit("bookingUpdated", booking);
        if (booking.provider) await notify({ app:req.app, user:booking.provider._id || booking.provider, title:"New job assigned", message:`${booking.service?.name || "A service"} has been assigned to you for ${booking.timeSlot || "the scheduled time"}.`, type:"booking", link:"provider.html", metadata:{ bookingId:booking._id } });
        await notify({ app:req.app, user:booking.customer?._id || booking.customer, title:"Booking updated by admin", message:`${booking.bookingCode || "Your booking"} is now ${booking.status}.`, type:"booking", link:"my-bookings.html", metadata:{ bookingId:booking._id } });
        res.json({ message: "Booking updated", booking });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get("/payment-settings", async (req, res) => {
    try {
        const settings = await AppSetting.findOneAndUpdate(
            { key: "platform" },
            { $setOnInsert: { key: "platform" } },
            { new: true, upsert: true }
        );
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/payment-settings", async (req, res) => {
    try {
        const enabled = Boolean(req.body.paymentQrEnabled);
        const upiId = String(req.body.upiId || "").trim();
        const customQrImage = String(req.body.customQrImage || "").trim();
        const validCustomQr = !customQrImage || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(customQrImage);
        if (!validCustomQr) return res.status(400).json({ message: "Upload a valid PNG, JPG or WebP QR image." });
        if (customQrImage.length > 1500000) return res.status(400).json({ message: "QR image is too large. Use an image below 1 MB." });
        if (enabled && !customQrImage && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(upiId)) {
            return res.status(400).json({ message: "Enter a valid UPI ID or upload a QR image before enabling QR payments." });
        }
        const settings = await AppSetting.findOneAndUpdate(
            { key: "platform" },
            {
                paymentQrEnabled: enabled,
                upiId,
                customQrImage,
                payeeName: String(req.body.payeeName || "HomeServe").trim(),
                paymentNote: String(req.body.paymentNote || "Home service payment").trim(),
                allowProviderSelfAccept: Boolean(req.body.allowProviderSelfAccept),
                cashOnDeliveryEnabled: req.body.cashOnDeliveryEnabled !== false,
                qrAmountMode: req.body.qrAmountMode === "fixed" ? "fixed" : "booking",
                fixedQrAmount: Math.max(1, Number(req.body.fixedQrAmount || 1))
            },
            { new: true, upsert: true, runValidators: true }
        );
        req.app.get("io")?.emit("payment-settings-updated", { enabled: settings.paymentQrEnabled });
        res.json({ message: "Payment QR settings updated", settings });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch("/bookings/:id/payment", async (req, res) => {
    try {
        const status = ["Paid","Rejected","Unpaid"].includes(req.body.status) ? req.body.status : "Unpaid";
        const booking = await Booking.findByIdAndUpdate(req.params.id, {
            "payment.status": status,
            "payment.paidAt": status === "Paid" ? new Date() : null,
            "payment.verificationSource": status === "Paid" ? "Admin" : "",
            "payment.transactionRef": String(req.body.transactionRef || "").trim()
        }, { new: true, runValidators: true });
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        req.app.get("io")?.emit("payment-status-updated", { bookingId: booking._id, status });
        await notify({ app:req.app, user:booking.customer, title:`Payment ${status}`, message:`Payment for ${booking.bookingCode || "your booking"} was marked ${status.toLowerCase()} by admin.`, type:"payment", link:"my-bookings.html", metadata:{ bookingId:booking._id } });
        res.json({ message: `Payment marked ${status.toLowerCase()}`, booking });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



router.get("/analytics", async (req, res) => {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const [monthlyRevenue, statusBreakdown, customerGrowth, workerPerformance, paymentBreakdown] = await Promise.all([
            Booking.aggregate([
                { $match: { status: "Completed", createdAt: { $gte: start } } },
                { $group: {
                    _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                    revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
                    bookings: { $sum: 1 }
                } },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            Booking.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            User.aggregate([
                { $match: { role: "customer", createdAt: { $gte: start } } },
                { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            Booking.aggregate([
                { $match: { provider: { $ne: null } } },
                { $group: {
                    _id: "$provider",
                    totalJobs: { $sum: 1 },
                    completedJobs: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
                    earnings: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, { $ifNull: ["$pricing.total", 0] }, 0] } }
                } },
                { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "worker" } },
                { $unwind: "$worker" },
                { $project: {
                    _id: 0,
                    providerId: "$_id",
                    name: "$worker.name",
                    available: "$worker.available",
                    totalJobs: 1,
                    completedJobs: 1,
                    earnings: 1,
                    completionRate: { $cond: [{ $gt: ["$totalJobs", 0] }, { $multiply: [{ $divide: ["$completedJobs", "$totalJobs"] }, 100] }, 0] }
                } },
                { $sort: { completedJobs: -1, earnings: -1 } },
                { $limit: 10 }
            ]),
            Booking.aggregate([
                { $group: { _id: { method: "$payment.method", status: "$payment.status" }, count: { $sum: 1 }, amount: { $sum: { $ifNull: ["$pricing.total", 0] } } } },
                { $sort: { count: -1 } }
            ])
        ]);

        const monthLabels = [];
        const revenueMap = new Map(monthlyRevenue.map(item => [`${item._id.year}-${item._id.month}`, item]));
        const customerMap = new Map(customerGrowth.map(item => [`${item._id.year}-${item._id.month}`, item.count]));
        for (let offset = 5; offset >= 0; offset--) {
            const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            monthLabels.push({
                key,
                label: date.toLocaleString("en-IN", { month: "short" }),
                revenue: revenueMap.get(key)?.revenue || 0,
                completedBookings: revenueMap.get(key)?.bookings || 0,
                newCustomers: customerMap.get(key) || 0
            });
        }

        const paidRevenue = await Booking.aggregate([
            { $match: { "payment.status": "Paid" } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", 0] } }, count: { $sum: 1 } } }
        ]);

        res.json({
            months: monthLabels,
            statuses: statusBreakdown.map(item => ({ status: item._id, count: item.count })),
            workers: workerPerformance,
            payments: paymentBreakdown.map(item => ({ method: item._id.method || "UPI QR", status: item._id.status || "Unpaid", count: item.count, amount: item.amount })),
            paidRevenue: paidRevenue[0]?.total || 0,
            paidBookings: paidRevenue[0]?.count || 0,
            generatedAt: new Date()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/system-health", async (req, res) => {
    try {
        const mongoose = require("mongoose");
        const settings = await AppSetting.findOne({ key: "platform" });
        const stateNames = ["Disconnected", "Connected", "Connecting", "Disconnecting"];
        const dbState = stateNames[mongoose.connection.readyState] || "Unknown";
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const paymentConfigured = Boolean(settings?.paymentQrEnabled && settings?.upiId) || settings?.cashOnDeliveryEnabled !== false;
        const checks = [
            { label: "MongoDB connection", ok: mongoose.connection.readyState === 1, detail: dbState },
            { label: "JWT secret configured", ok: Boolean(process.env.JWT_SECRET), detail: "Set JWT_SECRET in .env" },
            { label: "UPI QR configuration", ok: Boolean(settings?.paymentQrEnabled && settings?.upiId), detail: "Optional: configure UPI ID or keep QR disabled" },
            { label: "Cash on delivery", ok: settings?.cashOnDeliveryEnabled !== false, detail: "Enable COD in Payment QR settings" },
            { label: "Worker assignment control", ok: settings?.allowProviderSelfAccept !== true, detail: "Admin assignment is recommended" }
        ];
        res.json({
            checkedAt: new Date().toISOString(),
            api: { ok: true, uptimeSeconds, uptimeHuman: `${hours}h ${minutes}m`, node: process.version },
            database: { state: dbState, ok: mongoose.connection.readyState === 1 },
            realtime: { socketIo: Boolean(req.app.get("io")) },
            payments: { configured: paymentConfigured, summary: `${settings?.paymentQrEnabled ? "UPI enabled" : "UPI disabled"} · ${settings?.cashOnDeliveryEnabled !== false ? "COD enabled" : "COD disabled"}` },
            checks
        });
    } catch (err) {
        res.status(500).json({ message: "Unable to read system health." });
    }
});

module.exports = router;
