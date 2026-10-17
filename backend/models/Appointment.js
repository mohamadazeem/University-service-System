const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    notificationEvents: { type: [require("../utils/notificationEvent").schema], select: false, default: undefined },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: "AppointmentSlot" },
    reservedSlot: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    date: {
      type: Date,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed", "Cancelled"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  },
);

appointmentSchema.index({ staff: 1, status: 1, date: 1 });
module.exports = mongoose.model("Appointment", appointmentSchema);
