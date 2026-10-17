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

    department: { type: String, trim: true, maxlength: 120 },
    staffId: {
      type: String, unique: true, sparse: true, trim: true, maxlength: 50,
      set: require("../utils/staffId").normalize,
    },
    approvalStatus: {
      type: String, enum: ["pending", "approved", "rejected"],
      default: function () { return this.role === "staff" ? "pending" : undefined; },
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    approvalHistory: {
      type: [{
        status: { type: String, enum: ["approved", "rejected"] },
        department: String,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reviewedAt: Date,
      }],
      select: false, default: undefined,
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

userSchema.index({ role: 1, approvalStatus: 1, department: 1, createdAt: -1 });
module.exports = mongoose.model("User", userSchema);
