const jwt = require("jsonwebtoken");
const User = require("../models/user");
const mongoose = require("mongoose");
module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer "))
    return res.status(401).json({ message: "Please sign in" });
  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!mongoose.isObjectIdOrHexString(decoded.id))
      throw new Error("Invalid subject");
  } catch {
    return res
      .status(401)
      .json({ message: "Invalid or expired session. Please sign in again." });
  }
  try {
    // Current database permissions take precedence over roles in old JWTs.
    const user = await User.findById(decoded.id).select(
      "name email role active studentId phone department approvalStatus staffId",
    );
    if (!user || user.active === false)
      return res
        .status(401)
        .json({
          message: "This account is unavailable. Please sign in again.",
        });
    const approvalError = require("../utils/staffAccess").message(user);
    if (approvalError) return res.status(401).json({ message: approvalError });
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      phone: user.phone,
      department: user.department,
      approvalStatus: user.approvalStatus,
      staffId: user.staffId,
    };
    next();
  } catch (error) {
    next(error);
  }
};
