const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    eventKey: { type: String, unique: true, sparse: true },
    title: { type: String, maxlength: 160 },
    type: { type: String, enum: ["request", "appointment", "complaint", "staff-approval", "general"], default: "general" },
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    readAt: Date,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);
