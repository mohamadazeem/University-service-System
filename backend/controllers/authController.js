const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const v = require("../utils/validation");
const registerStaff = async (req, res) => {
  const input = req.body || {};
  const name = v.text(input.name, "Name", 100);
  const email = v.email(input.email);
  const password = v.password(input.password);
  if (password !== input.confirmPassword) v.fail("Passwords do not match");
  const department = await require("../utils/departments").validate(input.department);
  const staffId = v.text(input.staffId, "Staff ID", 50, false)?.toUpperCase();
  if (await User.exists({ email })) v.fail("Email already registered", 409);
  if (staffId && await User.exists({ staffId })) v.fail("Staff ID already registered", 409);
  await User.create({
    name, email, password: await bcrypt.hash(password, 12), department,
    ...(staffId && { staffId }), role: "staff", approvalStatus: "pending", active: true,
  });
  res.status(201).json({ message: "Registration submitted successfully. Your account is awaiting administrator approval." });
};
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
  const password = req.body?.password;
  if (typeof password !== "string" || !password.length || password.length > 200)
    v.fail("Provide a password of at most 200 characters");
  const portal = req.body?.portal === undefined
    ? undefined
    : v.choice(req.body.portal, ["student", "staff", "admin"], "portal");
  const user = await User.findOne({ email }).select("+password");
  if (
    !user ||
    user.active === false ||
    !(await bcrypt.compare(password, user.password))
  )
    v.fail("Invalid email or password", 401);
  const approvalError = require("../utils/staffAccess").message(user);
  if (approvalError) v.fail(approvalError, 403);
  // Portal selection restricts login; only the stored database role grants access.
  if (portal && user.role !== portal)
    v.fail(`This account does not have ${portal === "admin" ? "administrator" : portal} access. Choose the correct portal.`, 403);
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
      department: user.department,
      approvalStatus: user.approvalStatus,
      staffId: user.staffId,
    },
  });
};
module.exports = { registerUser, registerStaff, loginUser };
