const express = require("express");
const mongoose = require("mongoose");

const Service = require("../models/Service");
const Review = require("../models/Review");

const router = express.Router();

/*
========================================
GET ALL SERVICES WITH REAL RATINGS
GET /api/services
========================================
*/

router.get("/", async (req, res) => {
    try {
        const services = await Service.find()
            .sort({ name: 1 })
            .lean();

        const ratingSummary = await Review.aggregate([
            {
                $match: {
                    status: "Published"
                }
            },
            {
                $group: {
                    _id: "$service",
                    averageRating: {
                        $avg: "$rating"
                    },
                    reviewCount: {
                        $sum: 1
                    }
                }
            }
        ]);

        const ratingMap = new Map(
            ratingSummary.map((item) => [
                String(item._id),
                {
                    averageRating: Number(
                        item.averageRating.toFixed(1)
                    ),
                    reviewCount: item.reviewCount
                }
            ])
        );

        const servicesWithRatings = services.map((service) => {
            const rating = ratingMap.get(
                String(service._id)
            );

            return {
                ...service,
                averageRating:
                    rating?.averageRating || 0,
                reviewCount:
                    rating?.reviewCount || 0
            };
        });

        return res.json(servicesWithRatings);
    } catch (err) {
        console.error(
            "Unable to load services with ratings:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load services and ratings"
        });
    }
});

/*
========================================
GET ONE SERVICE WITH REAL RATING
GET /api/services/:id
========================================
*/

router.get("/:id", async (req, res) => {
    try {
        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid service ID"
            });
        }

        const service = await Service.findById(
            req.params.id
        ).lean();

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        const ratingSummary =
            await Review.aggregate([
                {
                    $match: {
                        service:
                            new mongoose.Types.ObjectId(
                                req.params.id
                            ),
                        status: "Published"
                    }
                },
                {
                    $group: {
                        _id: "$service",
                        averageRating: {
                            $avg: "$rating"
                        },
                        reviewCount: {
                            $sum: 1
                        }
                    }
                }
            ]);

        const rating = ratingSummary[0];

        return res.json({
            ...service,
            averageRating: rating
                ? Number(
                    rating.averageRating.toFixed(1)
                )
                : 0,
            reviewCount:
                rating?.reviewCount || 0
        });
    } catch (err) {
        console.error(
            "Unable to load service:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load service"
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
                description:
                    "Electrical wiring, fan installation, switch repair and maintenance.",
                category: "Electrical",
                price: 499
            },
            {
                name: "Plumber",
                description:
                    "Pipe leakage, bathroom fittings and tap installation.",
                category: "Plumbing",
                price: 399
            },
            {
                name: "AC Repair",
                description:
                    "AC installation, gas filling and servicing.",
                category: "Appliance",
                price: 799
            },
            {
                name: "Home Cleaning",
                description:
                    "Deep cleaning for complete home.",
                category: "Cleaning",
                price: 999
            },
            {
                name: "Carpenter",
                description:
                    "Furniture repair and woodwork.",
                category: "Woodwork",
                price: 599
            },
            {
                name: "Painting Service",
                description:
                    "Interior and exterior painting.",
                category: "Painting",
                price: 1499
            },
            {
                name: "Water Tank Cleaning",
                description:
                    "Professional overhead tank cleaning.",
                category: "Cleaning",
                price: 699
            },
            {
                name: "Appliance Repair",
                description:
                    "Repair refrigerator, washing machine and microwave.",
                category: "Appliance",
                price: 899
            },
            {
                name: "Pest Control",
                description:
                    "Cockroach, termite and mosquito control.",
                category: "Cleaning",
                price: 1199
            },
            {
                name: "Gardening",
                description:
                    "Garden maintenance and landscaping.",
                category: "Outdoor",
                price: 799
            }
        ];

        await Service.insertMany(services);

        return res.status(201).json({
            success: true,
            message:
                `${services.length} services inserted successfully.`
        });
    } catch (err) {
        console.error(
            "Unable to seed services:",
            err
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;