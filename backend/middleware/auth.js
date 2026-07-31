const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
    const header = String(req.header("Authorization") || "").trim();
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header;

    if (!token) {
        return res.status(401).json({ success: false, code: "NO_TOKEN", message: "Please log in to continue." });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Your session has expired. Please log in again." });
    }
};
