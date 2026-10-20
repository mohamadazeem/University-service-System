const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  startsAt: {
    type: Date,
    required: true
  },
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
  serviceName: { type: String, maxlength: 120 },
  category: { type: String, maxlength: 120 },
  title: { type: String, maxlength: 160, default: "Staff appointment" },
  description: { type: String, maxlength: 2000 },
  endsAt: Date,
  building: { type: String, maxlength: 120 },
  room: { type: String, maxlength: 120 },
  capacity: { type: Number, min: 1, max: 100, default: 1 },
  durationMinutes: { type: Number, min: 1, max: 480 },
  instructions: { type: String, maxlength: 2000 },
  status: { type: String, enum: ["Draft", "Published", "Closed", "Cancelled"], default: "Published" },
  revision: { type: Number, default: 0 },
  deletedAt: Date,
  location: { type: String, trim: true, maxlength: 300 },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
schema.index({
  staff: 1,
  startsAt: 1
}, {
  unique: true
});
schema.index({ staff: 1, startsAt: 1, endsAt: 1, status: 1 });
module.exports = mongoose.model("AppointmentSlot", schema);
