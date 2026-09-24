const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        staff: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        date: {
            type: Date,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        reason: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Completed"],
            default: "Pending"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Appointment", appointmentSchema);