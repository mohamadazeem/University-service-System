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
      enum: ["Pending", "In Review", "In Progress", "Resolved", "Rejected"],
      default: "Pending",
    },

    department: { type: String, trim: true, maxlength: 120 },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedAt: Date,
    investigationNotes: { type: String, maxlength: 4000, select: false },
    assignmentHistory: [{
      from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      administrator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      at: { type: Date, default: Date.now },
    }],
    category: { type: String, enum: require("../utils/supportWorkflow").categories, default: "General" },
    priority: { type: String, enum: require("../utils/supportWorkflow").priorities, default: "Medium" },
    history: [{
      kind: { type: String, default: "update" },
      assignedStaffName: String,
      investigationNotes: { type: String, select: false },
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
complaintSchema.index({ assignedStaff: 1, status: 1, createdAt: -1 });
complaintSchema.index({ department: 1, priority: 1, createdAt: -1 });
module.exports = mongoose.model("Complaint", complaintSchema);
