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
module.exports = mongoose.model("AppointmentSlot", schema);
