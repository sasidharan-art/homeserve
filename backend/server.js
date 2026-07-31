const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");
const cors = require("cors");
const path = require("path");

dotenv.config();

// ===================================
// Fix DNS Issues
// ===================================

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// ===================================
// Initialize Express
// ===================================

const app = express();
const server = http.createServer(app);

// ===================================
// Socket.IO
// ===================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Make io available in all routes
app.set("io", io);

// ===================================
// Middleware
// ===================================

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

// Prevent stale frontend/API responses during local development.
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") res.set("Cache-Control", "no-store");
    next();
});

// ===================================
// MongoDB Connection
// ===================================

mongoose.connect(process.env.MONGO_URI)
.then(() => {

    console.log("✅ MongoDB connected successfully");

})
.catch((err) => {

    console.log("❌ MongoDB Connection Error");

    console.log(err);

    process.exit(1);

});

// ===================================
// Import Routes
// ===================================

const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const providerRoutes = require("./routes/providerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const couponRoutes = require("./routes/couponRoutes");
const chatRoutes = require("./routes/chatRoutes");

// ===================================
// API Routes
// ===================================

app.use("/api/auth", authRoutes);

app.use("/api/services", serviceRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/provider", providerRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/reviews", reviewRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/coupons", couponRoutes);

app.use("/api/chat", chatRoutes);

app.get("/api/health", (req, res) => {
    res.json({ success: true, service: "HomeServe API", uptime: Math.floor(process.uptime()), database: mongoose.connection.readyState === 1 ? "Connected" : "Unavailable", checkedAt: new Date().toISOString() });
});

// ===================================
// Home Route
// ===================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ===================================
// Socket.IO
// ===================================

io.on("connection", (socket) => {

    console.log("🟢 User Connected :", socket.id);

    socket.on("disconnect", () => {

        console.log("🔴 User Disconnected :", socket.id);

    });

});

// ===================================
// Start Server
// ===================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);

});