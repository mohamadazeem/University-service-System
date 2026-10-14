const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const v = require("../utils/validation");
const registerUser = async (req, res) => {
  const input = req.body || {};
  const name = v.text(input.name, "Name", 100);
  const email = v.email(input.email);
  const password = v.password(input.password);
  const studentId = v.text(input.studentId, "Student ID", 50, false);
  const phone = v.text(input.phone, "Phone", 30, false);
  if (await User.exists({ email })) v.fail("Email already registered", 409);
  // Ignore supplied roles and arbitrary account fields on public registration.
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "student",
    ...(studentId && { studentId }),
    ...(phone && { phone }),
  });
  res
    .status(201)
    .json({
      message: "Registration successful. You can now sign in.",
      user: { id: user._id, name, email, role: user.role },
    });
};
const loginUser = async (req, res) => {
  const email = v.email(req.body?.email);
  const password = v.text(req.body?.password, "Password", 200);
  const user = await User.findOne({ email }).select("+password");
  if (
    !user ||
    user.active === false ||
    !(await bcrypt.compare(password, user.password))
  )
    v.fail("Invalid email or password", 401);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "8h",
    algorithm: "HS256",
  });
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      phone: user.phone,
    },
  });
};
module.exports = { registerUser, loginUser };
