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
const appointments = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Completed", "Rejected"],
  Rejected: [],
  Completed: []
};
const complaints = {
  Pending: ["In Review", "Resolved", "Rejected"],
  "In Review": ["Resolved", "Rejected"],
  Resolved: [],
  Rejected: []
};
exports.list = Model => async (req, res) => {
  const p = v.paging(req.query, ["createdAt", "updatedAt", "status"]);
  const filter = req.user.role === "admin" ? {} : {
    student: req.user.id
  };
  if (req.query.status) filter.status = v.choice(req.query.status, Object.keys(Model === Appointment ? appointments : complaints), "status");
  let query = Model.find(filter).sort(p.sort).skip(p.skip).limit(p.limit);
  if (req.user.role === "admin") query = query.populate("student", "name studentId");
  const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json({
    items,
    total,
    page: p.page,
    pages: Math.ceil(total / p.limit)
  });
};
exports.slots = async (req, res) => {
  const booked = await Appointment.find({
    reservedSlot: {
      $exists: true
    }
  }).select("reservedSlot");
  const staff = await User.find({
    role: "staff",
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
  v.body(req.body, ["staff", "startsAt"]);
  const staff = v.id(req.body.staff);
  const input = v.text(req.body.startsAt, "Start time", 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(input)) v.fail("Provide a UTC date and time");
  const startsAt = new Date(input);
  if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) v.fail("Choose a future date and time");
  if (startsAt.toISOString().slice(0, 19) !== input.slice(0, 19)) v.fail("Choose a valid date and time");
  if (!(await User.exists({
    _id: staff,
    role: "staff",
    active: {
      $ne: false
    }
  }))) v.fail("Choose an active staff member");
  const slot = await Slot.create({
    staff,
    startsAt
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
    active: {
      $ne: false
    }
  }))) v.fail("This appointment time is unavailable", 409);
  // Unique reservedSlot prevents simultaneous bookings of the same availability.
  const appointment = await Appointment.create({
    student: req.user.id,
    slot: slot._id,
    reservedSlot: slot._id,
    staff: slot.staff,
    date: slot.startsAt,
    time: slot.startsAt.toISOString().slice(11, 16),
    reason,
    notificationEvents: [event(req.user.id, "Your appointment booking is pending approval.")]
  });
  await tryFlush(Appointment, req.user.id);
  res.status(201).json({
    appointment: {
      _id: appointment._id,
      status: appointment.status
    }
  });
};
exports.submitComplaint = async (req, res) => {
  v.body(req.body, ["subject", "description"]);
  const complaint = await Complaint.create({
    student: req.user.id,
    subject: v.text(req.body.subject, "Subject", 160),
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
  v.body(req.body, isAppointment ? ["status", "expectedStatus"] : ["status", "expectedStatus", "response"]);
  const transitions = isAppointment ? appointments : complaints;
  const status = v.choice(req.body.status, Object.keys(transitions), "status");
  const expectedStatus = v.choice(req.body.expectedStatus, Object.keys(transitions), "expected status");
  if (!transitions[expectedStatus].includes(status)) v.fail("This status transition is not permitted", 409);
  const record = await Model.findById(v.id(req.params.id));
  if (!record) v.fail("Record not found", 404);
  const values = {
    status
  };
  if (!isAppointment) values.response = v.text(req.body.response, "Response", 4000);
  if (isAppointment && status === "Completed" && record.date > new Date()) v.fail("An appointment cannot be completed before it starts", 409);
  const update = {
    $set: values,
    $push: {
      notificationEvents: event(record.student, `${isAppointment ? "Appointment" : "Complaint"} status: ${status}.`)
    }
  };
  if (isAppointment && status === "Rejected") update.$unset = {
    reservedSlot: 1
  };
  const updated = await Model.findOneAndUpdate({
    _id: record._id,
    status: expectedStatus
  }, update, {
    returnDocument: "after",
    runValidators: true
  });
  if (!updated) v.fail("This record changed. Refresh and try again.", 409);
  await tryFlush(Model, record.student.toString());
  res.json({
    message: "Review saved",
    item: updated
  });
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
