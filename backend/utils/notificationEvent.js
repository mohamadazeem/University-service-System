const mongoose = require("mongoose");
exports.schema = new mongoose.Schema({
  key: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  message: String,
  audience: String,
  title: String,
  type: String,
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  occurredAt: Date,
}, {
  _id: false
});
exports.event = (user, message, metadata = {}) => ({
  key: new mongoose.Types.ObjectId().toString(),
  user,
  message,
  occurredAt: new Date(),
  ...metadata,
});
// A single active administrator owns the review queue (oldest account ID).
// Resolve on inbox reads so events survive an administrator being deactivated.
exports.adminEvent = (message, metadata = {}) => exports.event(undefined, message, { ...metadata, audience: "admin-review" });
