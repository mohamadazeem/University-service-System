const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    notificationEvents: { type: [require("../utils/notificationEvent").schema], select: false, default: undefined },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    service: {
      type: String,
      required: true,
    },

    studentId: {
      type: String,
      required: true,
      trim: true,
    },

    // Service name is a historical snapshot; new requests also store the reference.
    serviceRef: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },

    description: {
      type: String,
      required: true,
    },

    priority: {
      type: String,
      enum: ["Normal", "Urgent"],
      default: "Normal",
    },

    document: {
      type: String,
    },

    status: {
      type: String,
      enum: ["Pending", "Processing", "Approved", "Rejected", "Completed"],
      default: "Pending",
    },

    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    staffComment: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ student: 1, createdAt: -1 });
requestSchema.index({ serviceRef: 1 });
module.exports = mongoose.model("Request", requestSchema);
