const User = require("../models/user");
const v = require("../utils/validation");
const statuses = ["pending", "approved", "rejected"];
const statusFilter = (status) => status === "pending"
  ? { $or: [{ approvalStatus: "pending" }, { approvalStatus: null }] }
  : { approvalStatus: status };
const list = async (req, res) => {
  const p = v.paging(req.query, ["createdAt", "name", "email", "department", "updatedAt"]);
  const conditions = [{ role: "staff" }];
  if (req.query.approvalStatus)
    conditions.push(statusFilter(v.choice(req.query.approvalStatus, statuses, "approval status")));
  if (req.query.department)
    conditions.push({ department: v.text(req.query.department, "Department", 120) });
  if (req.query.q) {
    const regex = { $regex: v.escapeRegex(v.text(req.query.q, "Search", 100)), $options: "i" };
    conditions.push({ $or: ["name", "email", "staffId", "department"].map((key) => ({ [key]: regex })) });
  }
  const filter = { $and: conditions };
  const [items, total, counts] = await Promise.all([
    User.find(filter).sort(p.sort).skip(p.skip).limit(p.limit),
    User.countDocuments(filter),
    Promise.all(statuses.map((status) => User.countDocuments({ role: "staff", ...statusFilter(status) }))),
  ]);
  res.json({ items, total, page: p.page, pages: Math.ceil(total / p.limit), summary: Object.fromEntries(statuses.map((s, i) => [s, counts[i]])) });
};
const details = async (req, res) => {
  const user = await User.findOne({ _id: v.id(req.params.id), role: "staff" }).select("+approvalHistory");
  if (!user) v.fail("Staff registration not found", 404);
  res.json({ user });
};
const review = async (req, res) => {
  v.body(req.body, ["approvalStatus", "expectedStatus", "expectedUpdatedAt"]);
  const id = v.id(req.params.id);
  if (id === req.user.id) v.fail("You cannot review your own account", 403);
  const approvalStatus = v.choice(req.body.approvalStatus, ["approved", "rejected"], "approval status");
  const expected = v.choice(req.body.expectedStatus, statuses, "expected approval status");
  const timestamp = req.body.expectedUpdatedAt === null
    ? null : v.text(req.body.expectedUpdatedAt, "Last updated timestamp", 40);
  if (timestamp !== null && Number.isNaN(Date.parse(timestamp))) v.fail("Invalid last updated timestamp");
  const reviewedAt = new Date();
  const event = { status: approvalStatus, reviewedBy: req.user.id, reviewedAt };
  const user = await User.findOneAndUpdate({
    _id: id, role: "staff", updatedAt: timestamp === null ? null : new Date(timestamp), ...statusFilter(expected),
  }, {
    $set: { approvalStatus, reviewedBy: req.user.id, reviewedAt },
    $push: { approvalHistory: event },
  }, { returnDocument: "after", runValidators: true });
  if (!user) v.fail("Registration changed or no longer exists. Reload its details before reviewing.", 409);
  res.json({ message: `Staff registration ${approvalStatus}`, user });
};
module.exports = { list, details, review };
