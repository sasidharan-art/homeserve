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

// Render runs behind a reverse proxy.
// Required for express-rate-limit and correct client IP handling.
app.set("trust proxy", 1);

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

// Make Socket.IO available inside routes.
app.set("io", io);

// ===================================
// Middleware
// ===================================

app.use(cors());

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);

// Serve frontend files from the frontend folder.
app.use(express.static(path.join(__dirname, "../frontend")));

// Prevent stale frontend and API responses during local development.
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
        res.set("Cache-Control", "no-store");
    }

    next();
});

// ===================================
// MongoDB Connection
// ===================================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB connected successfully");
    })
    .catch((err) => {
        console.error("❌ MongoDB Connection Error");
        console.error(err);
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

// ===================================
// Health Check
// ===================================

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "HomeServe API",
        uptime: Math.floor(process.uptime()),
        database:
            mongoose.connection.readyState === 1
                ? "Connected"
                : "Unavailable",
        checkedAt: new Date().toISOString()
    });
});

// ===================================
// Home Route
// ===================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ===================================
// Socket.IO Events
// ===================================

io.on("connection", (socket) => {
    console.log("🟢 User Connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("🔴 User Disconnected:", socket.id);
    });
});

// ===================================
// 404 Handler
// ===================================

// Keep this after all API and frontend routes.
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "API route not found"
        });
    }

    return res.status(404).send("Page not found");
});

// ===================================
// Global Error Handler
// ===================================

app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

// ===================================
// Start Server
// ===================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});