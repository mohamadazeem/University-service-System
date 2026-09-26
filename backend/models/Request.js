const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        service: {
            type: String,
            required: true
        },

        studentId: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true
        },

        priority: {
            type: String,
            enum: ["Normal", "Urgent"],
            default: "Normal"
        },

        document: {
            type: String
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "Processing",
                "Approved",
                "Rejected",
                "Completed"
            ],
            default: "Pending"
        },

        assignedStaff: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        staffComment: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Request", requestSchema);