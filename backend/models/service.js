const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true
        },

        department: {
            type: String,
            required: true
        },

        processingTime: {
            type: String
        },

        active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Service", serviceSchema);