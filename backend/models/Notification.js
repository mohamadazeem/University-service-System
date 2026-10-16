const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    eventKey: { type: String, unique: true, sparse: true },
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
module.exports = mongoose.model("Notification", notificationSchema);
