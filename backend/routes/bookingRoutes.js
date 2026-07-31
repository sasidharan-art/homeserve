const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const auth = require("../middleware/auth");
const AppSetting = require("../models/AppSetting");
const { notify } = require("../utils/notificationService");
const Coupon = require("../models/Coupon");

function createBookingCode() {
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `HS-${date}-${suffix}`;
}

function expectedSlot(date) {
    return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Return occupied slots for a service on a selected day.
router.get("/availability", auth, async (req, res) => {
    try {
        const { service, date } = req.query;
        if (!service || !date) return res.status(400).json({ message: "Service and date are required." });

        const start = new Date(`${date}T00:00:00`);
        const end = new Date(`${date}T23:59:59.999`);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ message: "Invalid date." });

        const bookings = await Booking.find({
            service,
            bookingDate: { $gte: start, $lte: end },
            status: { $ne: "Cancelled" }
        }).select("timeSlot bookingDate");

        const unavailableSlots = [...new Set(bookings.map(item => item.timeSlot || expectedSlot(item.bookingDate)))];
        res.json({ date, unavailableSlots });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Convert customer coordinates into a readable nearby address.
// Keeping this behind the backend avoids browser CORS failures.
router.get("/reverse-geocode", auth, async (req, res) => {
    try {
        const latitude = Number(req.query.lat);
        const longitude = Number(req.query.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ message: "Valid latitude and longitude are required." });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                "User-Agent": "HomeServe-Student-Project/1.0"
            }
        });
        clearTimeout(timeout);
        if (!response.ok) return res.status(502).json({ message: "Address lookup service is unavailable." });
        const data = await response.json();
        const a = data.address || {};
        const parts = [a.house_number, a.road || a.pedestrian || a.residential, a.suburb || a.neighbourhood || a.quarter, a.city || a.town || a.village || a.municipality, a.state_district, a.state, a.postcode].filter(Boolean);
        const address = [...new Set(parts)].join(", ") || data.display_name || "";
        res.json({ address, latitude, longitude });
    } catch (err) {
        res.status(502).json({ message: "Automatic address lookup is temporarily unavailable." });
    }
});

router.post("/", auth, async (req, res) => {
    try {
        // Support the new booking wizard and older cached booking pages.
        // Older pages may send dateTime/date instead of bookingDate and omit timeSlot.
        const service = req.body.service || req.body.serviceId;
        const bookingDate = req.body.bookingDate || req.body.dateTime || req.body.datetime || req.body.date;
        let address = String(req.body.address || "").trim();
        const notes = req.body.notes;
        const emergency = req.body.emergency;
        const location = req.body.customerLocation || {};

        let timeSlot = req.body.timeSlot || req.body.time;
        if (!timeSlot && bookingDate) {
            const parsed = new Date(bookingDate);
            if (!Number.isNaN(parsed.getTime())) timeSlot = expectedSlot(parsed);
        }

        const hasCoordinates = Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
        if (!address && hasCoordinates) {
            address = `Current GPS location (${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)})`;
        }
        if (!service || !bookingDate || !timeSlot || (!address && !hasCoordinates)) {
            return res.status(400).json({ message: "Please select a service, future date, time slot and provide an address or current location." });
        }
        if (address.length < 10 && !hasCoordinates) {
            return res.status(400).json({ message: "Please enter a complete service address or share your current location." });
        }

        const selectedDate = new Date(bookingDate);
        if (Number.isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
            return res.status(400).json({ message: "Please select a future booking date and time." });
        }

        const selectedService = await Service.findById(service);
        if (!selectedService) return res.status(404).json({ message: "Selected service was not found." });

        const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);
        const occupied = await Booking.exists({ service, timeSlot, bookingDate: { $gte: dayStart, $lte: dayEnd }, status: { $ne: "Cancelled" } });
        if (occupied) return res.status(409).json({ message: "That time slot was just booked. Please choose another slot." });

        const base = Number(selectedService.price || 0);
        const visit = 49;
        const emergencyCharge = emergency ? Math.max(99, base * 0.15) : 0;
        const tax = Math.round((base + visit + emergencyCharge) * 0.18);
        const subtotal = Math.round(base + visit + emergencyCharge + tax);
        let discount = 0;
        let couponCode = "";
        const requestedCoupon = String(req.body.couponCode || "").trim().toUpperCase();
        let coupon = null;
        if (requestedCoupon) {
            coupon = await Coupon.findOne({ code: requestedCoupon });
            const now = new Date();
            if (!coupon || !coupon.active) return res.status(400).json({ message: "Coupon is invalid or inactive." });
            if (coupon.startsAt > now || coupon.expiresAt < now) return res.status(400).json({ message: "Coupon is not currently valid." });
            if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: "Coupon usage limit has been reached." });
            if (subtotal < coupon.minimumAmount) return res.status(400).json({ message: `Minimum order amount is ₹${coupon.minimumAmount}.` });
            discount = coupon.discountType === "percentage" ? Math.round(subtotal * coupon.discountValue / 100) : Math.round(coupon.discountValue);
            if (coupon.maximumDiscount > 0) discount = Math.min(discount, coupon.maximumDiscount);
            discount = Math.max(0, Math.min(discount, subtotal));
            couponCode = coupon.code;
        }
        const total = Math.max(0, subtotal - discount);

        const booking = new Booking({
            customer: req.user.id,
            service,
            bookingDate: selectedDate,
            timeSlot,
            address,
            notes: String(notes || "").trim(),
            emergency: Boolean(emergency),
            bookingCode: createBookingCode(),
            pricing: { base, visit, emergency: Math.round(emergencyCharge), tax, discount, couponCode, total },
            customerLocation: Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) ? {
                latitude: Number(location.latitude),
                longitude: Number(location.longitude),
                accuracy: Number(location.accuracy || 0) || null,
                capturedAt: new Date(),
                addressLabel: address
            } : undefined
        });

        await booking.save();
        if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
        await booking.populate("service");

        const io = req.app.get("io");
        if (io) io.emit("new-booking", booking);
        await notify({ app: req.app, role: "admin", title: "New service booking", message: `${booking.bookingCode} was created for ${booking.service?.name || "a home service"}.`, type: "booking", link: "admin.html#bookings", metadata: { bookingId: booking._id } });
        await notify({ app: req.app, user: req.user.id, title: "Booking confirmed", message: `${booking.service?.name || "Your service"} is booked for ${booking.timeSlot}.`, type: "booking", link: "my-bookings.html", metadata: { bookingId: booking._id } });

        res.status(201).json({ message: "Booking Created Successfully", booking });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/", auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ customer: req.user.id })
            .populate("service")
            .populate("provider", "name phone")
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get("/:id([0-9a-fA-F]{24})", auth, async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id })
            .populate("customer", "name email phone")
            .populate("provider", "name phone")
            .populate("service", "name category description price");
        if (!booking) return res.status(404).json({ message: "Booking not found." });
        res.json(booking);
    } catch (err) {
        if (err.name === "CastError") return res.status(400).json({ message: "Invalid booking ID." });
        res.status(500).json({ message: err.message });
    }
});

router.get("/payment-settings", auth, async (req, res) => {
    try {
        const settings = await AppSetting.findOneAndUpdate(
            { key: "platform" },
            { $setOnInsert: { key: "platform" } },
            { new: true, upsert: true }
        );
        res.json({
            enabled: settings.paymentQrEnabled,
            upiId: settings.paymentQrEnabled ? settings.upiId : "",
            customQrImage: settings.paymentQrEnabled ? settings.customQrImage : "",
            payeeName: settings.payeeName,
            paymentNote: settings.paymentNote,
            cashOnDeliveryEnabled: settings.cashOnDeliveryEnabled,
            qrAmountMode: settings.qrAmountMode,
            fixedQrAmount: settings.fixedQrAmount
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch("/:id/payment-method", auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id:req.params.id, customer:req.user.id });
    if (!booking) return res.status(404).json({ message:"Booking not found." });
    if (booking.status !== "Completed") return res.status(400).json({ message:"Payment is available after the worker completes the job." });
    const settings = await AppSetting.findOne({ key:"platform" });
    const method = req.body.method === "Cash on Delivery" ? "Cash on Delivery" : "UPI QR";
    if (method === "Cash on Delivery" && settings?.cashOnDeliveryEnabled === false) return res.status(400).json({ message:"Cash on delivery is disabled by admin." });
    if (method === "UPI QR" && (!settings?.paymentQrEnabled || (!settings?.upiId && !settings?.customQrImage))) return res.status(400).json({ message:"UPI QR payment is disabled by admin." });
    booking.payment.method = method;
    if (booking.payment.status !== "Paid") booking.payment.status = "Unpaid";
    await booking.save();
    res.json({ message:`Payment method set to ${method}.`, booking });
  } catch(err){ res.status(500).json({ message:err.message }); }
});

router.post("/:id/payment-claim", auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id:req.params.id, customer:req.user.id });
    if (!booking) return res.status(404).json({ message:"Booking not found." });
    if (booking.status !== "Completed") return res.status(400).json({ message:"Payment can be submitted only after job completion." });
    if (booking.payment.method !== "UPI QR") return res.status(400).json({ message:"Payment claim is only for UPI QR payments." });
    const ref=String(req.body.transactionRef||"").trim();
    if (ref.length < 6) return res.status(400).json({ message:"Enter a valid UPI transaction reference." });
    booking.payment.status="Pending Verification"; booking.payment.transactionRef=ref; booking.payment.claimedAt=new Date();
    await booking.save();
    req.app.get("io")?.emit("payment-status-updated", { bookingId:booking._id, status:booking.payment.status });
    await notify({ app:req.app, role:"admin", title:"UPI payment awaiting verification", message:`Payment claim submitted for ${booking.bookingCode || booking._id}.`, type:"payment", link:"admin.html#payments", metadata:{ bookingId:booking._id } });
    res.json({ message:"Payment submitted for verification.", booking });
  } catch(err){ res.status(500).json({ message:err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id });
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        if (booking.status === "Completed") return res.status(400).json({ message: "A completed booking cannot be cancelled." });

        booking.status = "Cancelled";
        await booking.save();
        const io = req.app.get("io");
        if (io) io.emit("booking-cancelled", { bookingId: req.params.id });
        await notify({ app:req.app, role:"admin", title:"Booking cancelled", message:`${booking.bookingCode || "A booking"} was cancelled by the customer.`, type:"booking", link:"admin.html#bookings", metadata:{ bookingId:booking._id } });
        res.json({ message: "Booking Cancelled Successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
