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
// Staff own their appointment resource; approved support staff review university complaints.
// Student routes always enforce ownership, irrespective of client filters.
const scope = (Model, user) => user.role === "student" ? { student: user.id }
  : user.role === "staff" && Model === Appointment ? { staff: user.id } : {};
const populateFor = Model => Model === Appointment ? [
  { path: "student", select: "name studentId email" },
  { path: "staff", select: "name" },
  { path: "slot", select: "startsAt location" },
] : [{ path: "student", select: "name studentId email" }];
exports.list = Model => async (req, res) => {
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
  if (req.user.role === "staff" && !booking) query = query.select("-description -response -history");
  const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json({ items, total, page: p.page, pages: Math.ceil(total / p.limit), statuses, priorities, categories });
};
exports.details = Model => async (req, res) => {
  const item = await Model.findOne({ _id: v.id(req.params.id), ...scope(Model, req.user) }).populate(populateFor(Model));
  if (!item) v.fail("Record not found", 404);
  res.json({ item, allowedStatuses: (Model === Appointment ? appointments : complaints)[item.status], priorities, categories });
};
exports.overview = async (req, res) => {
  const ownBookings = scope(Appointment, req.user);
  const unresolved = { status: { $in: ["Pending", "In Review"] } };
  const [pendingBookings, upcomingBookings, unresolvedComplaints, highPriorityComplaints] = await Promise.all([
    Appointment.countDocuments({ ...ownBookings, status: "Pending" }),
    Appointment.countDocuments({ ...ownBookings, status: "Approved", date: { $gt: new Date() } }),
    Complaint.countDocuments(unresolved),
    Complaint.countDocuments({ ...unresolved, priority: { $in: ["High", "Urgent"] } }),
  ]);
  res.json({ pendingBookings, upcomingBookings, unresolvedComplaints, highPriorityComplaints });
};
exports.slots = async (req, res) => {
  const booked = await Appointment.find({
    reservedSlot: {
      $exists: true
    }
  }).select("reservedSlot");
  const staff = await User.find({
    role: "staff",
    approvalStatus: "approved",
    active: {
      $ne: false
    }
  }).select("_id");
  const items = await Slot.find({
    active: true,
    staff: {
      $in: staff.map(row => row._id)
    },
    startsAt: {
      $gt: new Date()
    },
    _id: {
      $nin: booked.map(row => row.reservedSlot)
    }
  }).populate("staff", "name").sort({
    startsAt: 1
  }).limit(100);
  res.json({
    items
  });
};
exports.createSlot = async (req, res) => {
  v.body(req.body, ["staff", "startsAt", "location"]);
  const staff = v.id(req.body.staff);
  const input = v.text(req.body.startsAt, "Start time", 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(input)) v.fail("Provide a UTC date and time");
  const startsAt = new Date(input);
  if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) v.fail("Choose a future date and time");
  if (startsAt.toISOString().slice(0, 19) !== input.slice(0, 19)) v.fail("Choose a valid date and time");
  if (!(await User.exists({
    _id: staff,
    role: "staff",
      approvalStatus: "approved",
    active: {
      $ne: false
    }
  }))) v.fail("Choose an active staff member");
  const slot = await Slot.create({
    staff,
    startsAt,
    location: v.text(req.body.location, "Location", 200, false),
  });
  res.status(201).json({
    slot
  });
};
exports.closeSlot = async (req, res) => {
  const slot = await Slot.findByIdAndUpdate(v.id(req.params.id), {
    $set: {
      active: false
    }
  }, {
    returnDocument: "after"
  });
  if (!slot) v.fail("Availability not found", 404);
  res.json({
    message: "Availability closed. Existing bookings remain unchanged."
  });
};
exports.book = async (req, res) => {
  v.body(req.body, ["slot", "reason"]);
  const reason = v.text(req.body.reason, "Reason", 2000);
  const slot = await Slot.findOne({
    _id: v.id(req.body.slot),
    active: true,
    startsAt: {
      $gt: new Date()
    }
  });
  if (!slot || !(await User.exists({
    _id: slot.staff,
    role: "staff",
      approvalStatus: "approved",
    active: {
      $ne: false
    }
  }))) v.fail("This appointment time is unavailable", 409);
  // Unique reservedSlot prevents simultaneous bookings of the same availability.
  let appointment;
  try { appointment = await Appointment.create({
    student: req.user.id,
    slot: slot._id,
    reservedSlot: slot._id,
    staff: slot.staff,
    date: slot.startsAt,
    time: slot.startsAt.toISOString().slice(11, 16),
    reason,
    notificationEvents: [event(req.user.id, "Your appointment booking is pending approval.")]
  });
  } catch (error) {
    if (error.code === 11000) v.fail("This appointment time is already booked. Choose another available time.", 409);
    throw error;
  }
  await tryFlush(Appointment, req.user.id);
  res.status(201).json({
    appointment: {
      _id: appointment._id,
      status: appointment.status
    }
  });
};
exports.submitComplaint = async (req, res) => {
  v.body(req.body, ["subject", "description", "priority", "category"]);
  const complaint = await Complaint.create({
    student: req.user.id,
    subject: v.text(req.body.subject, "Subject", 160),
    priority: req.body.priority === undefined ? "Medium" : v.choice(req.body.priority, priorities, "priority"),
    category: req.body.category === undefined ? "General" : v.choice(req.body.category, categories, "category"),
    description: v.text(req.body.description, "Description", 4000),
    notificationEvents: [event(req.user.id, "Your complaint has been received for review.")]
  });
  await tryFlush(Complaint, req.user.id);
  res.status(201).json({
    complaint: {
      _id: complaint._id,
      status: complaint.status
    }
  });
};
exports.review = Model => async (req, res) => {
  const isAppointment = Model === Appointment;
  v.body(req.body, isAppointment ? ["status", "expectedStatus", "expectedUpdatedAt"] : ["status", "expectedStatus", "expectedUpdatedAt", "response", "priority"]);
  const transitions = isAppointment ? appointments : complaints;
  const status = v.choice(req.body.status, Object.keys(transitions), "status");
  const expectedStatus = v.choice(req.body.expectedStatus, Object.keys(transitions), "expected status");
  const sameComplaintStatus = !isAppointment && status === expectedStatus && transitions[expectedStatus].length > 0;
  if (!sameComplaintStatus && !transitions[expectedStatus].includes(status)) v.fail("This status transition is not permitted", 409);
  // Scope the lookup itself so another staff member's booking stays private.
  const record = await Model.findOne({ _id: v.id(req.params.id), ...scope(Model, req.user) });
  if (!record) v.fail("Record not found", 404);
  if (req.body.expectedUpdatedAt !== undefined || req.user.role === "staff") {
    const timestamp = v.text(req.body.expectedUpdatedAt, "Last updated timestamp", 40);
    if (!Number.isFinite(Date.parse(timestamp))) v.fail("Invalid last updated timestamp");
    if (new Date(timestamp).getTime() !== record.updatedAt?.getTime()) v.fail("This record changed. Refresh and try again.", 409);
  }
  const values = { status };
  if (!isAppointment) {
    values.response = v.text(req.body.response, "Response", 4000);
    if (req.body.priority !== undefined) values.priority = v.choice(req.body.priority, priorities, "priority");
  }
  if (isAppointment && status === "Completed" && record.date > new Date()) v.fail("An appointment cannot be completed before it starts", 409);
  if (isAppointment && status === "Approved" && record.date <= new Date()) v.fail("A past appointment cannot be approved", 409);
  const update = {
    $set: values,
    $push: { notificationEvents: event(record.student, `${isAppointment ? "Appointment" : "Complaint"} status: ${status}.`) },
  };
  if (!isAppointment) {
    const entry = { status, response: values.response, priority: values.priority || record.priority || "Medium",
      actor: req.user.id, actorName: req.user.name, actorRole: req.user.role, at: new Date() };
    const previous = !record.history?.length && record.response ? [{
      status: record.status, response: record.response, priority: record.priority || "Medium",
      actorName: "Previous university response", actorRole: "support", at: record.updatedAt,
    }] : [];
    update.$push.history = { $each: [...previous, entry] };
  }
  if (isAppointment && ["Rejected", "Cancelled"].includes(status)) update.$unset = { reservedSlot: 1 };
  const updated = await Model.findOneAndUpdate({
    _id: record._id, ...scope(Model, req.user), status: expectedStatus,
    ...(record.updatedAt && { updatedAt: record.updatedAt }),
  }, update, { returnDocument: "after", runValidators: true });
  if (!updated) v.fail("This record changed. Refresh and try again.", 409);
  await tryFlush(Model, record.student.toString());
  res.json({ message: isAppointment ? "Booking updated successfully." : "Complaint response saved successfully.", item: updated });
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
