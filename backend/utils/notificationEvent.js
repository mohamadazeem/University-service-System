const mongoose = require("mongoose");
exports.schema = new mongoose.Schema({
  key: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  message: String
}, {
  _id: false
});
exports.event = (user, message) => ({
  key: new mongoose.Types.ObjectId().toString(),
  user,
  message
});
