const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(

    {

        name: {

            type: String,

            required: true,

            unique: true,

            trim: true

        },

        description: {

            type: String,

            required: true,

            trim: true

        },

        category: {

            type: String,

            required: true,

            trim: true

        },

        price: {

            type: Number,

            required: true,

            default: 0,

            min: 0

        }

    },

    {

        timestamps: true

    }

);

module.exports = mongoose.model("Service", serviceSchema);