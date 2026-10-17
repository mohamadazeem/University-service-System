const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    notificationEvents: { type: [require("../utils/notificationEvent").schema], select: false, default: undefined },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    subject: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "In Review", "Resolved", "Rejected"],
      default: "Pending",
    },

    category: { type: String, enum: require("../utils/supportWorkflow").categories, default: "General" },
    priority: { type: String, enum: require("../utils/supportWorkflow").priorities, default: "Medium" },
    history: [{
      status: String,
      response: String,
      priority: String,
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      actorName: String,
      actorRole: String,
      at: { type: Date, default: Date.now },
    }],
    response: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });
module.exports = mongoose.model("Complaint", complaintSchema);
