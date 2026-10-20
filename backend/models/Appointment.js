const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    notificationEvents: { type: [require("../utils/notificationEvent").schema], select: false, default: undefined },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: "AppointmentSlot" },
    activeReservation: { type: Boolean, default: false },
    history: [{ status: String, reason: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: Date }],
    rejectionReason: { type: String, maxlength: 2000 },
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
      enum: ["Pending", "Approved", "In Progress", "Rejected", "Completed", "Cancelled"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  },
);

appointmentSchema.index({ slot: 1, student: 1 }, { unique: true, partialFilterExpression: { activeReservation: true } });
appointmentSchema.index({ slot: 1, status: 1 });
appointmentSchema.index({ student: 1, status: 1 });
appointmentSchema.index({ staff: 1, status: 1, date: 1 });
module.exports = mongoose.model("Appointment", appointmentSchema);
