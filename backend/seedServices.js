const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");

const Service = require("./models/Service");

dotenv.config();

// Use reliable DNS servers
dns.setServers(["1.1.1.1", "8.8.8.8"]);

mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {

        console.log("✅ MongoDB Connected");

        // Your services array goes here...

    })
    .catch((err) => {

        console.log("❌ MongoDB Error:", err.message);

        process.exit(1);

    });