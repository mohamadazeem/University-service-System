const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        subject: {
            type: String,
            required: true
        },

        description: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "In Review", "Resolved", "Rejected"],
            default: "Pending"
        },

        response: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Complaint", complaintSchema);