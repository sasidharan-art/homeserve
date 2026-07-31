const Notification = require("../models/Notification");

async function notify({ app, user = null, role = null, title, message, type = "system", link = "", metadata = {} }) {
  try {
    const notification = await Notification.create({ user, role, title, message, type, link, metadata });
    app?.get("io")?.emit("notification-created", {
      id: notification._id,
      user: user ? String(user) : null,
      role,
      title,
      message,
      type,
      link,
      createdAt: notification.createdAt
    });
    return notification;
  } catch (error) {
    console.error("Notification creation failed:", error.message);
    return null;
  }
}

module.exports = { notify };
