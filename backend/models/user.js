const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    active: { type: Boolean, default: true },

    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      set: (value) =>
        typeof value === "string" ? value.trim() || undefined : value,
    },

    phone: {
      type: String,
    },

    role: {
      type: String,
      enum: ["student", "staff", "admin"],
      default: "student",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
