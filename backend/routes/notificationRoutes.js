const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

router.use(auth);

function scopeFor(user) {
  return {
    $or: [
      { user: user.id },
      { role: user.role },
      { role: "all" }
    ]
  };
}

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const items = await Notification.find(scopeFor(req.user)).sort({ createdAt: -1 }).limit(limit).lean();
    const notifications = items.map(item => ({
      ...item,
      read: (item.readBy || []).some(id => String(id) === String(req.user.id))
    }));
    const unreadCount = notifications.filter(item => !item.read).length;
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { ...scopeFor(req.user), readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    res.json({ message: "All notifications marked as read." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...scopeFor(req.user) },
      { $addToSet: { readBy: req.user.id } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Notification marked as read." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
