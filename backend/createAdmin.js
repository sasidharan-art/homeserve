const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const dns = require("dns");

dotenv.config();

// Fix DNS issues
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const User = require("./models/User");

mongoose
    .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000
    })
    .then(async () => {

        console.log("✅ MongoDB Connected");

        const existingAdmin = await User.findOne({
            email: "admin@gmail.com"
        });

        if (existingAdmin) {

            console.log("⚠️ Admin already exists");

            await mongoose.connection.close();

            process.exit(0);

        }

        const hashedPassword = await bcrypt.hash("admin123", 10);

        const admin = new User({

            name: "Administrator",

            email: "admin@gmail.com",

            password: hashedPassword,

            role: "admin",

            phone: "9999999999",

            availability: true

        });

        await admin.save();

        console.log("✅ Admin Created Successfully");
        console.log("---------------------------");
        console.log("Email    : admin@gmail.com");
        console.log("Password : admin123");
        console.log("---------------------------");

        await mongoose.connection.close();

        process.exit(0);

    })
    .catch(async (err) => {

        console.error("❌ Error:", err);

        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }

        process.exit(1);

    });