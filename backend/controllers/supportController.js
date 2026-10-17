const Appointment = require("../models/Appointment");
const Slot = require("../models/AppointmentSlot");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const User = require("../models/user");
const Request = require("../models/Request");
const v = require("../utils/validation");
const {
  event
} = require("../utils/notificationEvent");
const {
  flush,
  tryFlush
} = require("../utils/notifications");
const { appointments, complaints, priorities, categories } = require("../utils/supportWorkflow");
// Appointment ownership is separate from the assignment-scoped complaint controller.
// Student routes always enforce ownership, irrespective of client filters.
const scope = (Model, user) => user.role === "student" ? { student: user.id }
  : user.role === "staff" && Model === Appointment ? { staff: user.id } : {};
const populateFor = Model => Model === Appointment ? [
  { path: "student", select: "name studentId email" },
  { path: "staff", select: "name" },
  { path: "slot", select: "startsAt endsAt location building room title description instructions serviceName category durationMinutes" },
] : [{ path: "student", select: "name studentId email" }];
exports.list = Model => async (req, res) => {
  if (Model === Complaint) return require("./complaintController").list(req, res);
  const booking = Model === Appointment;
  const p = v.paging(req.query, booking ? ["createdAt", "updatedAt", "status", "date"] : ["createdAt", "updatedAt", "status"]);
  const filter = scope(Model, req.user);
  const statuses = Object.keys(booking ? appointments : complaints);
  if (req.query.status) filter.status = v.choice(req.query.status, statuses, "status");
  if (req.query.view) {
    const view = v.choice(req.query.view, booking ? ["upcoming"] : ["unresolved", "high-priority"], "view");
    if (booking) { filter.status = "Approved"; filter.date = { $gt: new Date() }; }
    else {
      filter.status = { $in: ["Pending", "In Review"] };
      if (view === "high-priority") filter.priority = { $in: ["High", "Urgent"] };
    }
  }
  if (!booking && req.query.priority) filter.priority = v.choice(req.query.priority, priorities, "priority");
  if (!booking && req.query.category) filter.category = v.choice(req.query.category, categories, "category");
  // Include historical records whose missing fields use the schema defaults.
  if (!booking && filter.priority === "Medium") {
    filter.$and = [{ $or: [{ priority: "Medium" }, { priority: { $exists: false } }] }];
    delete filter.priority;
  }
  if (!booking && filter.category === "General") {
    filter.$and = [...(filter.$and || []), { $or: [{ category: "General" }, { category: { $exists: false } }] }];
    delete filter.category;
  }
  if (req.query.q) {
    const q = v.text(req.query.q, "Search", 100);
    const regex = { $regex: v.escapeRegex(q), $options: "i" };
    const students = await User.find({ $or: [{ name: regex }, { studentId: regex }] }).select("_id").lean();
    filter.$or = [{ student: { $in: students.map(user => user._id) } }, { [booking ? "reason" : "subject"]: regex }];
    if (/^[a-f\d]{24}$/i.test(q)) filter.$or.push({ _id: q });
  }
  let query = Model.find(filter).sort(p.sort).skip(p.skip).limit(p.limit);
  if (req.user.role !== "student") query = query.populate(populateFor(Model));
  else if (booking) query = query.populate(populateFor(Model).slice(1));
  if (req.user.role === "staff" && !booking) query = query.select("-description -response -history");
  const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json({ items, total, page: p.page, pages: Math.ceil(total / p.limit), statuses, priorities, categories });
};
exports.details = Model => async (req, res) => {
  if (Model === Complaint) return require("./complaintController").details(req, res);
  const item = await Model.findOne({ _id: v.id(req.params.id), ...scope(Model, req.user) }).populate(populateFor(Model));
  if (!item) v.fail("Record not found", 404);
  res.json({ item, allowedStatuses: (Model === Appointment ? appointments : complaints)[item.status], priorities, categories });
};
exports.overview = async (req, res) => {
  const [pendingBookings, upcomingBookings] = await Promise.all([
    Appointment.countDocuments({ staff: req.user.id, status: "Pending" }),
    Appointment.countDocuments({ staff: req.user.id, status: "Approved", date: { $gt: new Date() } }),
  ]);
  res.json({ pendingBookings, upcomingBookings });
};
const scheduling = require("./appointmentController");
exports.slots = scheduling.list(true);
exports.createSlot = scheduling.create(true);
exports.closeSlot = scheduling.closeLegacy;
exports.book = scheduling.book;
exports.submitComplaint = require("./complaintController").submit;
exports.review = Model => async (req, res) => {
  if (Model === Appointment) return scheduling.review(req, res);
  return require("./complaintController").review(req, res);
};
exports.notifications = async (req, res) => {
  for (const Model of [Appointment, Complaint, Request]) await flush(Model, req.user.id);
  const p = v.paging(req.query, ["createdAt"]);
  const filter = {
    user: req.user.id
  };
  const [items, total, unread] = await Promise.all([Notification.find(filter).sort(p.sort).skip(p.skip).limit(p.limit), Notification.countDocuments(filter), Notification.countDocuments({
    ...filter,
    isRead: false
  })]);
  res.json({
    items,
    total,
    unread,
    pages: Math.ceil(total / p.limit)
  });
};
exports.readNotification = async (req, res) => {
  const item = await Notification.findOneAndUpdate({
    _id: v.id(req.params.id),
    user: req.user.id
  }, {
    $set: {
      isRead: true
    }
  }, {
    returnDocument: "after"
  });
  if (!item) v.fail("Notification not found", 404);
  res.json({
    item
  });
};
exports.Appointment = Appointment;
exports.Complaint = Complaint;
