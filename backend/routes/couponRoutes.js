const express = require("express");
const Coupon = require("../models/Coupon");
const auth = require("../middleware/auth");
const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access only." });
  next();
}

function computeDiscount(coupon, subtotal) {
  let discount = coupon.discountType === "percentage"
    ? Math.round(subtotal * coupon.discountValue / 100)
    : Math.round(coupon.discountValue);
  if (coupon.maximumDiscount > 0) discount = Math.min(discount, coupon.maximumDiscount);
  return Math.max(0, Math.min(discount, subtotal));
}

router.post("/validate", auth, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const subtotal = Number(req.body.subtotal || 0);
    if (!code || !Number.isFinite(subtotal) || subtotal <= 0) return res.status(400).json({ message: "Coupon code and valid subtotal are required." });
    const coupon = await Coupon.findOne({ code });
    const now = new Date();
    if (!coupon || !coupon.active) return res.status(404).json({ message: "Coupon is invalid or inactive." });
    if (coupon.startsAt > now) return res.status(400).json({ message: "This coupon is not active yet." });
    if (coupon.expiresAt < now) return res.status(400).json({ message: "This coupon has expired." });
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: "This coupon usage limit has been reached." });
    if (subtotal < coupon.minimumAmount) return res.status(400).json({ message: `Minimum order amount is ₹${coupon.minimumAmount}.` });
    const discount = computeDiscount(coupon, subtotal);
    res.json({ valid: true, coupon: { code: coupon.code, description: coupon.description }, discount, finalTotal: Math.max(0, subtotal - discount) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/admin", auth, adminOnly, async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json(coupons);
});

router.post("/admin", auth, adminOnly, async (req, res) => {
  try {
    const payload = { ...req.body, code: String(req.body.code || "").trim().toUpperCase() };
    if (!payload.code || !payload.discountType || !payload.discountValue || !payload.expiresAt) return res.status(400).json({ message: "Code, discount, and expiry are required." });
    if (payload.discountType === "percentage" && Number(payload.discountValue) > 100) return res.status(400).json({ message: "Percentage discount cannot exceed 100%." });
    const coupon = await Coupon.create(payload);
    res.status(201).json({ message: "Coupon created.", coupon });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Coupon code already exists." });
    res.status(500).json({ message: err.message });
  }
});

router.patch("/admin/:id", auth, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ message: "Coupon not found." });
    res.json({ message: "Coupon updated.", coupon });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/admin/:id", auth, adminOnly, async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found." });
  res.json({ message: "Coupon deleted." });
});

module.exports = router;
module.exports.computeDiscount = computeDiscount;
