const express = require("express");
const Service = require("../models/Service");

const router = express.Router();

/*
========================================
GET ALL SERVICES
GET /api/services
========================================
*/

router.get("/", async (req, res) => {

    try {

        const services = await Service.find().sort({ name: 1 });

        res.json(services);

    }

    catch (err) {

        res.status(500).json({

            message: err.message

        });

    }

});


/*
========================================
ADD DEFAULT SERVICES
POST /api/services/seed
Run only once
========================================
*/

router.post("/seed", async (req, res) => {
    try {

        await Service.deleteMany();

        const services = [

            {
                name: "Electrician",
                description: "Electrical wiring, fan installation, switch repair and maintenance.",
                category: "Electrical",
                price: 499
            },

            {
                name: "Plumber",
                description: "Pipe leakage, bathroom fittings and tap installation.",
                category: "Plumbing",
                price: 399
            },

            {
                name: "AC Repair",
                description: "AC installation, gas filling and servicing.",
                category: "Appliance",
                price: 799
            },

            {
                name: "Home Cleaning",
                description: "Deep cleaning for complete home.",
                category: "Cleaning",
                price: 999
            },

            {
                name: "Carpenter",
                description: "Furniture repair and woodwork.",
                category: "Woodwork",
                price: 599
            },

            {
                name: "Painting Service",
                description: "Interior and exterior painting.",
                category: "Painting",
                price: 1499
            },

            {
                name: "Water Tank Cleaning",
                description: "Professional overhead tank cleaning.",
                category: "Cleaning",
                price: 699
            },

            {
                name: "Appliance Repair",
                description: "Repair refrigerator, washing machine and microwave.",
                category: "Appliance",
                price: 899
            },

            {
                name: "Pest Control",
                description: "Cockroach, termite and mosquito control.",
                category: "Cleaning",
                price: 1199
            },

            {
                name: "Gardening",
                description: "Garden maintenance and landscaping.",
                category: "Outdoor",
                price: 799
            }

        ];

        await Service.insertMany(services);

        res.status(201).json({

            success: true,

            message: `${services.length} services inserted successfully.`

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

module.exports = router;