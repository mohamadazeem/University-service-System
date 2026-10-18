const User = require("../models/user");
const Request = require("../models/Request");
const bcrypt = require("bcryptjs");
const v = require("../utils/validation");
const roles = ["student", "staff", "admin"];
const listUsers = async (req, res) => {
  const p = v.paging(req.query, [
    "createdAt",
    "name",
    "email",
    "role",
    "updatedAt",
  ]);
  const filter = {};
  if (req.query.role) filter.role = v.choice(req.query.role, roles, "role");
  if (req.query.active !== undefined)
    filter.active =
      v.choice(req.query.active, ["true", "false"], "account status") === "true"
        ? { $ne: false }
        : false;
  if (req.query.q) {
    const regex = {
      $regex: v.escapeRegex(v.text(req.query.q, "Search", 100)),
      $options: "i",
    };
    filter.$or = ["name", "email", "studentId"].map((field) => ({
      [field]: regex,
    }));
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort(p.sort).skip(p.skip).limit(p.limit),
    User.countDocuments(filter),
  ]);
  res.json({ items, total, page: p.page, pages: Math.ceil(total / p.limit) });
};
const getUser = async (req, res) => {
  const recordId = v.id(req.params.id);
  const user = await User.findById(recordId);
  if (!user) v.fail("User not found", 404);
  const requestCount = await Request.countDocuments({
    $or: [{ student: recordId }, { assignedStaff: recordId }],
  });
  res.json({ user, requestCount });
};
const staffOptions = async (req, res) => {
  const staff = await User.find({ role: "staff", ...(req.query.availability === "true" ? {} : { active: { $ne: false }, approvalStatus: "approved" }) })
    .select("name email")
    .sort({ name: 1 });
  res.json({ staff });
};
const createUser = async (req, res) => {
  v.body(req.body, ["name", "email", "password", "role", "studentId", "phone"]);
  const name = v.text(req.body.name, "Name", 100);
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);
  const role = v.choice(req.body.role, roles, "role");
  const studentId = v.text(req.body.studentId, "Student ID", 50, false);
  const phone = v.text(req.body.phone, "Phone", 30, false);
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role,
    ...(studentId && { studentId }),
    phone,
  });
  res
    .status(201)
    .json({
      message: "Account created",
      user: { _id: user._id, name, email, role },
    });
};
const updateUser = async (req, res) => {
  v.body(req.body, ["name", "email", "phone", "studentId", "active"]);
  const recordId = v.id(req.params.id);
  const values = {};
  for (const [key, max] of [
    ["name", 100],
    ["phone", 30],
    ["studentId", 50],
  ]) {
    if (req.body[key] !== undefined)
      values[key] = v.text(req.body[key], key, max, key === "name");
  }
  if (req.body.email !== undefined) values.email = v.email(req.body.email);
  if (req.body.active !== undefined)
    values.active = v.boolean(req.body.active, "Active");
  const user = await User.findById(recordId);
  if (!user) v.fail("User not found", 404);
  if (
    values.active === false &&
    (recordId === req.user.id || user.role === "admin")
  )
    v.fail("Administrator accounts cannot be deactivated in the portal", 409);
  const update = { $set: values };
  if (values.studentId === "") {
    delete values.studentId;
    update.$unset = { studentId: 1 };
  }
  // Protect against a concurrent promotion before deactivation.
  const filter = {
    _id: recordId,
    ...(values.active === false && { role: { $ne: "admin" } }),
  };
  const updated = await User.findOneAndUpdate(filter, update, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!updated) v.fail("Account changed. Reload the page.", 409);
  res.json({ message: "Account updated", user: updated });
};
const changeRole = async (req, res) => {
  v.body(req.body, ["role"]);
  const recordId = v.id(req.params.id);
  const role = v.choice(req.body.role, roles, "role");
  const user = await User.findById(recordId);
  if (!user) v.fail("User not found", 404);
  if (recordId === req.user.id || user.role === "admin")
    v.fail(
      "Existing administrator roles are protected from portal changes",
      409,
    );
  if (user.active === false && role === "admin")
    v.fail("Reactivate the account before promoting it", 409);
  const updated = await User.findOneAndUpdate(
    { _id: recordId, role: user.role, active: { $ne: false } },
    { $set: { role, ...(role === "staff" && user.role !== "staff" ? { approvalStatus: "pending" } : {}) } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) v.fail("Account changed or inactive. Reload its details.", 409);
  res.json({ message: "Role updated", user: updated });
};
const deactivateUser = async (req, res) => {
  const recordId = v.id(req.params.id);
  if (recordId === req.user.id)
    v.fail("You cannot deactivate your own account", 409);
  const user = await User.findById(recordId);
  if (!user) v.fail("User not found", 404);
  if (user.role === "admin")
    v.fail("Administrator accounts are protected", 409);
  const updated = await User.findOneAndUpdate(
    { _id: recordId, role: { $ne: "admin" } },
    { $set: { active: false } },
    { returnDocument: "after" },
  );
  if (!updated) v.fail("Account changed. Reload its details.", 409);
  res.json({
    message: "Account deactivated. Historical records are preserved.",
    user: updated,
  });
};
module.exports = {
  listUsers,
  getUser,
  staffOptions,
  createUser,
  updateUser,
  changeRole,
  deactivateUser,
};
