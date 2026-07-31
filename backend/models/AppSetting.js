const mongoose = require("mongoose");

const appSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "platform" },
  paymentQrEnabled: { type: Boolean, default: false },
  upiId: { type: String, trim: true, default: "" },
  customQrImage: { type: String, default: "" },
  payeeName: { type: String, trim: true, default: "HomeServe" },
  paymentNote: { type: String, trim: true, maxlength: 120, default: "Home service payment" },
  allowProviderSelfAccept: { type: Boolean, default: false },
  cashOnDeliveryEnabled: { type: Boolean, default: true },
  qrAmountMode: { type: String, enum: ["booking", "fixed"], default: "booking" },
  fixedQrAmount: { type: Number, min: 1, default: 1 },
  razorpayAutoVerifyEnabled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("AppSetting", appSettingSchema);
