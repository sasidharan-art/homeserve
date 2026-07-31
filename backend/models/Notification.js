const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  role: { type: String, enum: ["customer", "provider", "admin", "all"], default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  type: { type: String, enum: ["booking", "payment", "review", "system"], default: "system" },
  link: { type: String, default: "", trim: true },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

notificationSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);
