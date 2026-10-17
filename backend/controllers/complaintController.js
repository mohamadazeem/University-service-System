const Complaint = require("../models/Complaint");
const User = require("../models/user");
const Service = require("../models/service");
const v = require("../utils/validation");
const { complaints: transitions, priorities, categories } = require("../utils/supportWorkflow");
const { event } = require("../utils/notificationEvent");
const { tryFlush } = require("../utils/notifications");
const scope = user => user.role === "student" ? { student: user.id } : user.role === "staff" ? { assignedStaff: user.id } : {};
const populate = [
  { path: "student", select: "name email studentId phone" },
  { path: "assignedStaff", select: "name email department staffId" },
  { path: "assignedBy", select: "name" },
];
const openStatuses = ["Pending", "In Review", "In Progress"];
function observed(record, input, required) {
  if (input === undefined && !required) return;
  const timestamp = v.text(input, "Last updated timestamp", 40);
  if (!Number.isFinite(Date.parse(timestamp))) v.fail("Invalid last updated timestamp");
  if (new Date(timestamp).getTime() !== record.updatedAt?.getTime()) v.fail("This complaint changed. Reload its details.", 409);
}
function staffFilter(department) {
  return { role: "staff", active: { $ne: false }, approvalStatus: "approved", ...(department && { $or: [{ department }, { department: null }, { department: "" }] }) };
}
async function department(value) {
  const name = v.text(value, "Department", 120, false);
  if (name && !(await Service.exists({ department: name }))) v.fail("Choose an existing service department");
  return name || undefined;
}
function publicItem(record, user) {
  const item = record.toObject ? record.toObject() : record;
  if (user.role === "student") {
    delete item.investigationNotes;
    for (const entry of item.history || []) delete entry.investigationNotes;
    delete item.assignmentHistory;
  }
  delete item.notificationEvents;
  return item;
}
exports.list = async (req, res) => {
  const p = v.paging(req.query, ["createdAt", "updatedAt", "status"]);
  const filter = scope(req.user);
  if (req.query.status) filter.status = v.choice(req.query.status, Object.keys(transitions), "status");
  if (req.query.department) filter.department = v.text(req.query.department, "Department", 120);
  if (req.query.priority) filter.priority = v.choice(req.query.priority, priorities, "priority");
  if (req.query.category) filter.category = v.choice(req.query.category, categories, "category");
  if (req.query.view) {
    const view = v.choice(req.query.view, ["unresolved", "high-priority", "unassigned", "in-progress"], "view");
    if (view === "unassigned") {
      if (req.user.role !== "admin") v.fail("Only administrators can view unassigned complaints", 403);
      filter.assignedStaff = null;
    } else { filter.status = { $in: view === "in-progress" ? ["In Review", "In Progress"] : openStatuses }; if (view === "high-priority") filter.priority = { $in: ["High", "Urgent"] }; }
  }
  if (req.query.assignment) {
    if (req.user.role !== "admin") v.fail("Assignment filters require administrator access", 403);
    const assignment = v.choice(req.query.assignment, ["assigned", "unassigned"], "assignment filter");
    filter.assignedStaff = assignment === "assigned" ? { $ne: null } : null;
  }
  for (const [key, operator] of [["from", "$gte"], ["to", "$lte"]]) {
    if (req.query[key]) {
      const date = v.text(req.query[key], "Date", 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) v.fail("Use a valid YYYY-MM-DD date");
      filter.createdAt = { ...filter.createdAt, [operator]: new Date(date + (key === "from" ? "T00:00:00.000Z" : "T23:59:59.999Z")) };
    }
  }
  if (filter.createdAt?.$gte > filter.createdAt?.$lte) v.fail("Start date must be before end date");
  if (filter.priority === "Medium") { filter.$and = [{ $or: [{ priority: "Medium" }, { priority: { $exists: false } }] }]; delete filter.priority; }
  if (filter.category === "General") { filter.$and = [...(filter.$and || []), { $or: [{ category: "General" }, { category: { $exists: false } }] }]; delete filter.category; }
  if (req.query.q) {
    const q = v.text(req.query.q, "Search", 100), regex = { $regex: v.escapeRegex(q), $options: "i" };
    const students = await User.find({ $or: [{ name: regex }, { email: regex }, { studentId: regex }] }).select("_id").lean();
    filter.$or = [{ subject: regex }, { student: { $in: students.map(user => user._id) } }];
    if (/^[a-f\d]{24}$/i.test(q)) filter.$or.push({ _id: q });
  }
  let query = Complaint.find(filter).sort(p.sort).skip(p.skip).limit(p.limit);
  if (req.user.role !== "student") query = query.populate(populate);
  else query = query.populate({ path: "assignedStaff", select: "name department" });
  if (req.user.role === "staff") query = query.select("-description -response -history -assignmentHistory");
  const [records, total, departments] = await Promise.all([query, Complaint.countDocuments(filter), Service.distinct("department")]);
  res.json({ items: records.map(item => publicItem(item, req.user)), total, page: p.page, pages: Math.ceil(total/p.limit), statuses: Object.keys(transitions), priorities, categories, departments: departments.sort() });
};
exports.details = async (req, res) => {
  let query = Complaint.findOne({ _id: v.id(req.params.id), ...scope(req.user) }).populate(populate);
  if (req.user.role !== "student") query = query.select("+investigationNotes +history.investigationNotes");
  const item = await query;
  if (!item) v.fail("Complaint not found", 404);
  const allowedStatuses = req.user.role === "staff"
    ? (transitions[item.status] || []).filter(status => ["In Progress", "Resolved"].includes(status)) : transitions[item.status];
  res.json({ item: publicItem(item, req.user), allowedStatuses, priorities, categories });
};
exports.submit = async (req, res) => {
  v.body(req.body, ["subject", "description", "category", "priority", "department"]);
  const item = await Complaint.create({ student: req.user.id,
    subject: v.text(req.body.subject, "Subject", 160), description: v.text(req.body.description, "Description", 4000),
    category: req.body.category === undefined ? "General" : v.choice(req.body.category, categories, "category"),
    priority: req.body.priority === undefined ? "Medium" : v.choice(req.body.priority, priorities, "priority"),
    department: await department(req.body.department), assignedStaff: null,
    notificationEvents: [event(req.user.id, "Your complaint has been received for review.")],
  });
  await tryFlush(Complaint, req.user.id);
  res.status(201).json({ complaint: { _id: item._id, status: item.status } });
};
exports.staffOptions = async (req, res) => {
  const name = req.query.department ? v.text(req.query.department, "Department", 120) : undefined;
  const staff = await User.find(staffFilter(name)).select("name email staffId department").sort({ department: 1, name: 1 });
  res.json({ staff });
};
exports.assign = async (req, res) => {
  v.body(req.body, ["assignedStaff", "expectedUpdatedAt"]);
  const record = await Complaint.findById(v.id(req.params.id));
  if (!record) v.fail("Complaint not found", 404);
  observed(record, req.body.expectedUpdatedAt, true);
  if (!openStatuses.includes(record.status)) v.fail("Closed complaints cannot be reassigned", 409);
  const selected = req.body.assignedStaff === null ? null : v.id(req.body.assignedStaff);
  let staff;
  if (selected) {
    staff = await User.findOne({ _id: selected, ...staffFilter(record.department) }).select("name department");
    if (!staff) v.fail("Choose approved active staff from this department or university-wide support");
  }
  if (String(record.assignedStaff || "") === String(selected || "")) v.fail("This assignment is already current");
  const at = new Date(), status = !selected ? "Pending" : record.status === "Pending" ? "In Progress" : record.status;
  const updated = await Complaint.findOneAndUpdate({ _id: record._id, updatedAt: record.updatedAt, assignedStaff: record.assignedStaff || null }, {
    $set: { assignedStaff: selected, assignedBy: req.user.id, assignedAt: at, status },
    $push: {
      assignmentHistory: { from: record.assignedStaff || null, to: selected, administrator: req.user.id, at },
      history: { $each: [...(!record.history?.length && record.response ? [{ kind: "update", status: record.status, response: record.response, actorName: "Previous university response", actorRole: "support", at: record.updatedAt }] : []), { kind: "assignment", status, assignedStaffName: staff?.name || "Unassigned", actor: req.user.id, actorName: req.user.name, actorRole: "admin", at }] },
      notificationEvents: event(record.student, selected ? "Your complaint has been assigned to university staff for investigation." : "Your complaint is awaiting reassignment by an administrator."),
    },
  }, { returnDocument: "after", runValidators: true }).populate(populate);
  if (!updated) v.fail("This complaint changed. Reload its details.", 409);
  await tryFlush(Complaint, String(record.student));
  res.json({ message: selected ? "Complaint assigned successfully." : "Complaint unassigned successfully.", item: publicItem(updated, req.user) });
};
exports.review = async (req, res) => {
  v.body(req.body, ["status", "expectedStatus", "expectedUpdatedAt", "response", "priority", "investigationNotes"]);
  const status = v.choice(req.body.status, Object.keys(transitions), "status"), expectedStatus = v.choice(req.body.expectedStatus, Object.keys(transitions), "expected status");
  const same = status === expectedStatus && openStatuses.includes(status);
  if (!same && !(transitions[expectedStatus] || []).includes(status)) v.fail("This status transition is not permitted", 409);
  const response = v.text(req.body.response, "Response", 4000);
  const record = await Complaint.findOne({ _id: v.id(req.params.id), ...scope(req.user) }).select("+investigationNotes +history.investigationNotes");
  if (!record) v.fail("Complaint not found", 404);
  observed(record, req.body.expectedUpdatedAt, req.user.role === "staff");
  if (record.status !== expectedStatus) v.fail("This complaint changed. Reload its details.", 409);
  if (req.user.role === "staff" && !["In Progress", "Resolved"].includes(status) && !same) v.fail("Staff can only start or resolve their assigned complaints", 403);
  const values = { status, response };
  if (req.body.priority !== undefined) values.priority = v.choice(req.body.priority, priorities, "priority");
  if (req.body.investigationNotes !== undefined) values.investigationNotes = v.text(req.body.investigationNotes, "Investigation notes", 4000, false);
  const previous = !record.history?.length && record.response ? [{ status: record.status, response: record.response, priority: record.priority || "Medium", actorName: "Previous university response", actorRole: "support", at: record.updatedAt }] : [];
  const updated = await Complaint.findOneAndUpdate({ _id: record._id, ...scope(req.user), status: expectedStatus, ...(record.updatedAt && { updatedAt: record.updatedAt }) }, {
    $set: values, $push: {
      history: { $each: [...previous, { kind: "update", status, response, priority: values.priority || record.priority || "Medium", investigationNotes: values.investigationNotes, actor: req.user.id, actorName: req.user.name, actorRole: req.user.role, at: new Date() }] },
      notificationEvents: event(record.student, `Complaint status: ${status}.`),
    },
  }, { returnDocument: "after", runValidators: true }).populate(populate);
  if (!updated) v.fail("This complaint changed. Reload its details.", 409);
  await tryFlush(Complaint, String(record.student));
  res.json({ message: "Complaint response saved successfully.", item: publicItem(updated, req.user) });
};
exports.overview = async (req, res) => {
  const [total, unassigned, pending, inProgress, resolved, highPriority] = await Promise.all([
    Complaint.countDocuments({}), Complaint.countDocuments({ assignedStaff: null }), Complaint.countDocuments({ status: "Pending" }),
    Complaint.countDocuments({ status: { $in: ["In Review", "In Progress"] } }), Complaint.countDocuments({ status: "Resolved" }),
    Complaint.countDocuments({ status: { $in: openStatuses }, priority: { $in: ["High", "Urgent"] } }),
  ]);
  res.json({ total, unassigned, pending, inProgress, resolved, highPriority });
};
