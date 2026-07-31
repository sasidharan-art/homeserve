const express = require("express");
const router = express.Router();
const { notify } = require("../utils/notificationService");

const Booking = require("../models/Booking");
const User = require("../models/User");
const AppSetting = require("../models/AppSetting");
const auth = require("../middleware/auth");

const providerOnly = async (req, res, next) => {
    try {
        const provider = await User.findById(req.user.id);
        if (!provider) return res.status(404).json({ message: "User not found" });
        if (provider.role !== "provider") return res.status(403).json({ message: "Access denied. Provider only." });
        if (provider.isActive === false) return res.status(403).json({ message: "This provider account is inactive." });
        req.provider = provider;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

router.use(auth, providerOnly);

router.get("/payment-settings", async (req, res) => {
    try {
        const settings = await AppSetting.findOneAndUpdate(
            { key: "platform" },
            { $setOnInsert: { key: "platform" } },
            { new: true, upsert: true }
        );
        res.json({ enabled: settings.paymentQrEnabled, upiId: settings.paymentQrEnabled ? settings.upiId : "", customQrImage: settings.paymentQrEnabled ? settings.customQrImage : "", payeeName: settings.payeeName, paymentNote: settings.paymentNote, allowProviderSelfAccept: settings.allowProviderSelfAccept, cashOnDeliveryEnabled: settings.cashOnDeliveryEnabled, qrAmountMode: settings.qrAmountMode, fixedQrAmount: settings.fixedQrAmount });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/profile", async (req, res) => {
    res.json({
        id: req.provider._id,
        name: req.provider.name,
        email: req.provider.email,
        phone: req.provider.phone,
        available: req.provider.available,
        isActive: req.provider.isActive,
        skills: req.provider.skills || [],
        experienceYears: req.provider.experienceYears || 0,
        workerVerification: req.provider.workerVerification || {}
    });
});

// A provider can see open requests plus jobs assigned to that provider.
router.get("/bookings", async (req, res) => {
    try {
        const settings = await AppSetting.findOne({ key: "platform" });
        const visibility = settings?.allowProviderSelfAccept
            ? { $or: [{ provider: req.provider._id }, { provider: null, status: "Pending" }] }
            : { provider: req.provider._id };
        const bookings = await Booking.find(visibility)
            .populate("customer", "name email phone")
            .populate("service", "name category price description")
            .populate("provider", "name")
            .sort({ bookingDate: 1, createdAt: -1 });
        res.json(bookings.map(item => {
            const booking = item.toObject();
            if (!booking.provider) booking.customerLocation = undefined;
            return booking;
        }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/dashboard", async (req, res) => {
    try {
        const providerId = req.provider._id;
        const bookings = await Booking.find({ provider: providerId })
            .populate("customer", "name email phone")
            .populate("service", "name category price")
            .sort({ bookingDate: 1, createdAt: -1 });

        const settings = await AppSetting.findOne({ key: "platform" });
        const openRequests = settings?.allowProviderSelfAccept ? await Booking.countDocuments({ provider: null, status: "Pending" }) : 0;
        const accepted = bookings.filter(b => b.status === "Accepted").length;
        const onTheWay = bookings.filter(b => b.status === "On the Way").length;
        const completedBookings = bookings.filter(b => b.status === "Completed");
        const completed = completedBookings.length;
        const earnings = completedBookings.reduce((sum, b) => sum + Number(b.pricing?.total || b.service?.price || 0), 0);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const todayJobs = bookings.filter(b => b.bookingDate >= todayStart && b.bookingDate <= todayEnd && !["Cancelled", "Completed"].includes(b.status));

        const monthly = [];
        for (let offset = 5; offset >= 0; offset--) {
            const start = new Date();
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            start.setMonth(start.getMonth() - offset);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            const monthBookings = completedBookings.filter(b => b.bookingDate >= start && b.bookingDate < end);
            monthly.push({
                label: start.toLocaleString("en", { month: "short" }),
                jobs: monthBookings.length,
                earnings: monthBookings.reduce((sum, b) => sum + Number(b.pricing?.total || b.service?.price || 0), 0)
            });
        }

        res.json({
            profile: {
                id: req.provider._id,
                name: req.provider.name,
                email: req.provider.email,
                phone: req.provider.phone,
                available: req.provider.available,
                skills: req.provider.skills || [],
                experienceYears: req.provider.experienceYears || 0,
                workerVerification: req.provider.workerVerification || {}
            },
            stats: { openRequests, accepted, onTheWay, completed, earnings, todayJobs: todayJobs.length },
            todayJobs,
            monthly
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/status/:id", async (req, res) => {
    try {
        const allowed = ["Accepted", "On the Way", "Completed"];
        const { status } = req.body;
        if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid provider status." });

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        if (["Cancelled", "Completed"].includes(booking.status)) return res.status(400).json({ message: `This booking is already ${booking.status.toLowerCase()}.` });

        const isOwner = booking.provider && booking.provider.toString() === req.provider._id.toString();
        if (booking.provider && !isOwner) return res.status(409).json({ message: "This job has already been accepted by another provider." });

        const transitions = {
            Pending: "Accepted",
            Accepted: "On the Way",
            "On the Way": "Completed"
        };
        if (transitions[booking.status] !== status) {
            return res.status(400).json({ message: `Change ${booking.status} to ${transitions[booking.status] || "the next valid status"} first.` });
        }

        if (status === "Accepted" && req.provider.available === false) {
            return res.status(400).json({ message: "Set yourself available before accepting a new job." });
        }

        booking.provider = req.provider._id;
        booking.status = status;
        booking.statusHistory.push({ status, changedBy: req.provider._id });
        await booking.save();
        await booking.populate("customer", "name email phone");
        await booking.populate("service", "name category price");

        const io = req.app.get("io");
        if (io) io.emit("booking-status-updated", booking);
        const statusMessages = { "Accepted":"Your worker accepted the service request.", "On the Way":"Your worker is on the way.", "Completed":"The service has been completed. Choose a payment method and leave a review." };
        await notify({ app:req.app, user:booking.customer?._id || booking.customer, title:`Booking ${status}`, message:statusMessages[status] || `Booking status changed to ${status}.`, type:"booking", link:"my-bookings.html", metadata:{ bookingId:booking._id } });
        res.json({ success: true, message: `Booking updated to ${status}.`, booking });
    } catch (err) {
        if (err.name === "CastError") return res.status(400).json({ message: "Invalid booking ID." });
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put("/location/:id", async (req, res) => {
    try {
        const latitude = Number(req.body.latitude);
        const longitude = Number(req.body.longitude);
        const accuracy = Number(req.body.accuracy || 0) || null;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ message: "Valid latitude and longitude are required." });
        }
        const booking = await Booking.findOne({ _id: req.params.id, provider: req.provider._id });
        if (!booking) return res.status(404).json({ message: "Assigned booking not found." });
        if (!["Accepted", "On the Way"].includes(booking.status)) return res.status(400).json({ message: "Live location can be shared only for an active job." });
        booking.providerLocation = { latitude, longitude, accuracy, updatedAt: new Date(), sharing: true };
        await booking.save();
        req.app.get("io")?.emit("provider-location-updated", { bookingId: booking._id, providerLocation: booking.providerLocation });
        res.json({ message: "Live location updated.", providerLocation: booking.providerLocation });
    } catch (err) {
        if (err.name === "CastError") return res.status(400).json({ message: "Invalid booking ID." });
        res.status(500).json({ message: err.message });
    }
});

router.delete("/location/:id", async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, provider: req.provider._id });
        if (!booking) return res.status(404).json({ message: "Assigned booking not found." });
        booking.providerLocation.sharing = false;
        booking.providerLocation.updatedAt = new Date();
        await booking.save();
        req.app.get("io")?.emit("provider-location-updated", { bookingId: booking._id, providerLocation: booking.providerLocation });
        res.json({ message: "Live location sharing stopped." });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/bookings/:id/payment-method", async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, provider: req.provider._id });
        if (!booking) return res.status(404).json({ message: "Assigned booking not found." });
        if (booking.status !== "Completed") return res.status(400).json({ message: "Complete the job before choosing payment." });

        const settings = await AppSetting.findOne({ key: "platform" });
        const method = req.body.method;
        if (!["UPI QR", "Cash on Delivery"].includes(method)) return res.status(400).json({ message: "Choose UPI QR or Cash on Delivery." });
        if (method === "UPI QR" && (!settings?.paymentQrEnabled || (!settings?.upiId && !settings?.customQrImage))) return res.status(400).json({ message: "UPI QR payment is disabled by the administrator." });
        if (method === "Cash on Delivery" && settings?.cashOnDeliveryEnabled === false) return res.status(400).json({ message: "Cash on delivery is disabled by the administrator." });

        booking.payment.method = method;
        if (booking.payment.status !== "Paid") {
            booking.payment.status = "Unpaid";
            booking.payment.paidAt = null;
            booking.payment.verificationSource = "";
        }
        await booking.save();
        req.app.get("io")?.emit("payment-status-updated", { bookingId: booking._id, status: booking.payment.status, method });
        res.json({ message: `${method} selected.`, booking });
    } catch (err) {
        if (err.name === "CastError") return res.status(400).json({ message: "Invalid booking ID." });
        res.status(500).json({ message: err.message });
    }
});

router.post("/bookings/:id/mark-paid", async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, provider: req.provider._id });
        if (!booking) return res.status(404).json({ message: "Assigned booking not found." });
        if (booking.status !== "Completed") return res.status(400).json({ message: "Complete the job before collecting payment." });
        if (booking.payment.status === "Paid") return res.status(400).json({ message: "This payment is already marked paid." });

        const settings = await AppSetting.findOne({ key: "platform" });
        if (booking.payment.method === "UPI QR" && (!settings?.paymentQrEnabled || (!settings?.upiId && !settings?.customQrImage))) return res.status(400).json({ message: "UPI QR payment is disabled by the administrator." });
        if (booking.payment.method === "Cash on Delivery" && settings?.cashOnDeliveryEnabled === false) return res.status(400).json({ message: "Cash on delivery is disabled by the administrator." });

        booking.payment.status = "Paid";
        booking.payment.paidAt = new Date();
        booking.payment.verificationSource = booking.payment.method === "Cash on Delivery" ? "Worker Cash" : "Worker UPI";
        booking.payment.transactionRef = String(req.body.transactionRef || booking.payment.transactionRef || "").trim();
        await booking.save();

        req.app.get("io")?.emit("payment-status-updated", { bookingId: booking._id, status: "Paid", method: booking.payment.method });
        await notify({ app:req.app, user:booking.customer, title:"Payment recorded", message:`Your ${booking.payment.method} payment for ${booking.bookingCode || "the booking"} was marked paid by the worker.`, type:"payment", link:"my-bookings.html", metadata:{ bookingId:booking._id } });
        await notify({ app:req.app, role:"admin", title:"Worker confirmed payment", message:`${booking.payment.method} payment for ${booking.bookingCode || booking._id} was marked paid by the worker.`, type:"payment", link:"admin.html#payments", metadata:{ bookingId:booking._id } });
        res.json({ message: "Payment marked as paid.", booking });
    } catch (err) {
        if (err.name === "CastError") return res.status(400).json({ message: "Invalid booking ID." });
        res.status(500).json({ message: err.message });
    }
});

router.put("/availability", async (req, res) => {
    try {
        if (typeof req.body.available !== "boolean") return res.status(400).json({ message: "Availability must be true or false." });
        req.provider.available = req.body.available;
        await req.provider.save();
        const io = req.app.get("io");
        if (io) io.emit("provider-availability", { providerId: req.provider._id, available: req.provider.available });
        res.json({ success: true, message: req.provider.available ? "You are now available for jobs." : "You are now offline.", available: req.provider.available });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
