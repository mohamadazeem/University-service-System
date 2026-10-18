const mongoose = require("mongoose");
const Slot = require("../models/AppointmentSlot");
const Appointment = require("../models/Appointment");
const User = require("../models/user");
const Service = require("../models/service");
const v = require("../utils/validation");
const { event } = require("../utils/notificationEvent");
const { tryFlush } = require("../utils/notifications");
const { appointments: transitions } = require("../utils/supportWorkflow");
const occupiedStatuses = ["Pending", "Approved", "Completed"];
const slotScope = user => user.role === "staff" ? { staff: user.id } : {};
const endTime = slot => slot.endsAt || new Date(new Date(slot.startsAt).getTime() + 30 * 60000);
const capacity = slot => slot.capacity || 1;
const publicStatus = slot => slot.status === "Cancelled" ? "Cancelled" : slot.active === false ? "Closed" : slot.status || "Published";
const slotPopulate = [{ path: "staff", select: "name department" }, { path: "service", select: "name department active" }];
async function notifyStudents(students) {
  const unique = [...new Set(students)];
  for (let offset = 0; offset < unique.length; offset += 8) {
    await Promise.all(unique.slice(offset, offset + 8).map(student => tryFlush(Appointment, student)));
  }
}
async function transact(action) {
  try { return await mongoose.connection.transaction(action); }
  catch (error) {
    if (error.code === 20 || error.codeName === "IllegalOperation") v.fail("Appointment changes require a MongoDB replica set or Atlas connection. Contact your administrator.", 503);
    if (error.code === 11000) v.fail("This time is already booked or conflicts with existing availability.", 409);
    throw error;
  }
}
function instant(value, label) {
  const text = v.text(value, label, 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(text)) v.fail("Provide a UTC date and time");
  const date = new Date(text);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== text.slice(0, 19)) v.fail("Choose a valid date and time");
  return date;
}
function integer(value, label, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) v.fail(`${label} must be an integer from 1 to ${max}`);
  return value;
}
function observed(record, value) {
  const text = v.text(value, "Last updated timestamp", 40);
  if (!Number.isFinite(Date.parse(text))) v.fail("Invalid last updated timestamp");
  if (new Date(text).getTime() !== record.updatedAt?.getTime()) v.fail("This record changed. Refresh and try again.", 409);
}
async function scheduleLock(staff, session) {
  // All schedule creators/editors write the same staff document inside their
  // transaction. A concurrent overlapping insert is retried against fresh data.
  await User.updateOne({ _id: staff }, { $inc: { appointmentScheduleVersion: 1 } }, { session, timestamps: false });
}
async function checkOverlap(staff, startsAt, endsAt, exclude, session) {
  const conflict = await Slot.exists({ staff, ...(exclude && { _id: { $ne: exclude } }), active: { $ne: false }, status: { $nin: ["Cancelled", "Closed"] },
    startsAt: { $lt: endsAt }, $expr: { $gt: [{ $ifNull: ["$endsAt", { $add: ["$startsAt", 1800000] }] }, startsAt] },
  }).session(session);
  if (conflict) v.fail("This time overlaps another appointment for the same staff member.", 409);
}
async function fields(body, user, legacy = false) {
  v.body(body, ["staff", "service", "title", "description", "startsAt", "endsAt", "building", "room", "capacity", "durationMinutes", "instructions", "status", "location"]);
  if (user.role === "staff" && body.staff !== undefined) v.fail("Staff cannot select another slot owner");
  const staff = user.role === "staff" ? user.id : v.id(body.staff);
  const startsAt = instant(body.startsAt, "Start time");
  const endsAt = body.endsAt === undefined && legacy ? new Date(startsAt.getTime() + 1800000) : instant(body.endsAt, "End time");
  if (startsAt <= new Date()) v.fail("Choose a future date and time");
  if (endsAt <= startsAt || endsAt - startsAt > 8 * 3600000) v.fail("End time must be after start time and within 8 hours");
  const values = { staff, startsAt, endsAt, capacity: body.capacity === undefined ? 1 : integer(body.capacity, "Capacity", 100),
    title: legacy && body.title === undefined ? "Staff appointment" : v.text(body.title, "Appointment title", 160),
    description: v.text(body.description, "Description", 2000, false) ?? "",
    building: v.text(body.building, "Building / department", 120, false) ?? "",
    room: v.text(body.room, "Room / office", 120, false) ?? "",
    instructions: v.text(body.instructions, "Instructions", 2000, false),
    status: body.status === undefined ? "Published" : v.choice(body.status, ["Draft", "Published"], "availability status"),
  };
  if (body.durationMinutes !== undefined) {
    values.durationMinutes = integer(body.durationMinutes, "Duration", 480);
    if (values.durationMinutes * 60000 > endsAt - startsAt) v.fail("Duration cannot exceed the availability window");
  }
  if (body.service !== undefined || !legacy) {
    const service = await Service.findOne({ _id: v.id(body.service), active: { $ne: false } });
    if (!service) v.fail("Choose an active university service");
    values.service = service._id; values.serviceName = service.name; values.category = service.department;
  }
  values.location = values.building ? [values.building, values.room].filter(Boolean).join(" / ") : v.text(body.location, "Location", 300, false) ?? "";
  if (!(await User.exists({ _id: staff, role: "staff", approvalStatus: "approved", active: { $ne: false } }))) v.fail("Choose an active staff member");
  return values;
}
exports.create = legacy => async (req, res) => {
  const values = await fields(req.body, req.user, legacy);
  const slot = await transact(async session => {
    await scheduleLock(values.staff, session);
    await checkOverlap(values.staff, values.startsAt, values.endsAt, null, session);
    return (await Slot.create([values], { session }))[0];
  });
  res.status(201).json({ message: values.status === "Draft" ? "Availability saved as draft." : "Availability published successfully.", slot });
};
async function enriched(items) {
  if (!items.length) return [];
  const counts = await Appointment.aggregate([{ $match: { slot: { $in: items.map(item => item._id) }, status: { $in: occupiedStatuses } } }, { $group: { _id: "$slot", total: { $sum: 1 } } }]);
  const byId = new Map(counts.map(item => [String(item._id), item.total]));
  return items.map(item => ({ ...item.toObject(), endsAt: endTime(item), status: publicStatus(item), capacity: capacity(item), booked: byId.get(String(item._id)) || 0, remaining: Math.max(0, capacity(item) - (byId.get(String(item._id)) || 0)) }));
}
exports.list = discovery => async (req, res) => {
  const p = v.paging(req.query, ["startsAt", "createdAt", "title"]);
  const filter = discovery ? { active: true, status: { $in: ["Published", null] }, startsAt: { $gt: new Date() } } : slotScope(req.user);
  if (!discovery && req.query.status) {
    const status = v.choice(req.query.status, ["Draft", "Published", "Closed", "Cancelled"], "status");
    if (status === "Closed") Object.assign(filter, { active: false, status: { $ne: "Cancelled" } });
    else if (status === "Published") Object.assign(filter, { active: true, status: { $in: ["Published", null] } });
    else filter.status = status;
  }
  if (req.query.service) filter.service = v.id(req.query.service);
  if (req.query.date) {
    const date = v.text(req.query.date, "Date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) v.fail("Use a valid YYYY-MM-DD date");
    const from = new Date(date + "T00:00:00+05:30");
    filter.startsAt = { ...(filter.startsAt || {}), $gte: from, $lt: new Date(from.getTime() + 86400000) };
  }
  if (req.query.q) {
    const regex = { $regex: v.escapeRegex(v.text(req.query.q, "Search", 100)), $options: "i" };
    filter.$or = ["title", "serviceName", "category", "building", "room", "location"].map(field => ({ [field]: regex }));
  }
  if (discovery) {
    const staff = await User.find({ role: "staff", approvalStatus: "approved", active: { $ne: false } }).select("_id");
    filter.staff = { $in: staff.map(user => user._id) };
    // A deactivated service cannot accept new reservations; legacy slots remain usable.
    const services = await Service.find({ active: { $ne: false } }).select("_id");
    filter.$and = [{ $or: [{ service: { $in: services.map(service => service._id) } }, { service: null }] }];
  }
  if (!discovery) {
    const [records, total] = await Promise.all([
      Slot.find(filter).populate(slotPopulate).sort(p.sort).skip(p.skip).limit(p.limit),
      Slot.countDocuments(filter),
    ]);
    return res.json({ items: await enriched(records), total, page: p.page, pages: Math.ceil(total / p.limit) });
  }
  let items = await enriched(await Slot.find(filter).populate(slotPopulate).sort({ startsAt: 1, _id: 1 }));
  if (discovery) items = items.filter(item => item.remaining > 0);
  const total = items.length;
  res.json({ items: items.slice(p.skip, p.skip + p.limit), total, page: p.page, pages: Math.ceil(total / p.limit) });
};
exports.details = async (req, res) => {
  const slot = await Slot.findOne({ _id: v.id(req.params.id), ...slotScope(req.user) }).populate(slotPopulate);
  if (!slot) v.fail("Availability not found", 404);
  const bookings = await Appointment.find({ slot: slot._id }).populate("student", "name email studentId").sort({ createdAt: 1 });
  res.json({ slot: (await enriched([slot]))[0], bookings });
};
exports.update = async (req, res) => {
  v.body(req.body, ["expectedUpdatedAt", "action", "service", "title", "description", "startsAt", "endsAt", "building", "room", "location", "capacity", "durationMinutes", "instructions", "status"]);
  const affected = [];
  const slot = await transact(async session => {
    const slot = await Slot.findOne({ _id: v.id(req.params.id), ...slotScope(req.user) }).session(session);
    if (!slot) v.fail("Availability not found", 404);
    observed(slot, req.body.expectedUpdatedAt);
    if (["Cancelled", "Closed"].includes(publicStatus(slot))) v.fail("Closed or cancelled availability cannot be edited", 409);
    await scheduleLock(slot.staff, session);
    const action = req.body.action === undefined ? "edit" : v.choice(req.body.action, ["cancel", "edit"], "action");
    const bookings = await Appointment.find({ slot: slot._id, status: { $in: occupiedStatuses } }).session(session);
    if (action === "cancel") {
      slot.status = "Cancelled"; slot.active = false;
      const active = await Appointment.find({ slot: slot._id, status: { $in: ["Pending", "Approved"] } }).select("+notificationEvents").session(session);
      if (active.length) await Appointment.bulkWrite(active.map(booking => ({ updateOne: {
        filter: { _id: booking._id }, update: {
          $set: { status: "Cancelled", activeReservation: false }, $unset: { reservedSlot: 1 },
          $push: {
            notificationEvents: { $each: [event(booking.student, "Your appointment was cancelled because the availability was cancelled."), event(slot.staff, "An appointment booking was cancelled with its availability.")] },
            history: { status: "Cancelled", actor: req.user.id, at: new Date() },
          },
        },
      } })), { session });
      affected.push(...active.map(booking => String(booking.student)));
    } else {
      if (slot.startsAt <= new Date()) v.fail("Past availability cannot be edited", 409);
      if (req.body.startsAt !== undefined) instant(req.body.startsAt, "Start time");
      if (req.body.endsAt !== undefined) instant(req.body.endsAt, "End time");
      const body = { ...slot.toObject(), ...req.body }; delete body.expectedUpdatedAt;
      const requested = Object.fromEntries(["staff", "service", "title", "description", "startsAt", "endsAt", "building", "room", "capacity", "durationMinutes", "instructions", "status", "location"].filter(key => body[key] !== undefined).map(key => [key, body[key]]));
      // A combined location replaces the address; omitted locations retain legacy details.
      if (req.body.location !== undefined) { requested.building = ""; requested.room = ""; }
      requested.startsAt = new Date(requested.startsAt).toISOString(); requested.endsAt = new Date(endTime(body)).toISOString();
      if (req.user.role === "staff") delete requested.staff;
      else requested.staff = String(slot.staff);
      if (requested.service) requested.service = String(requested.service);
      const values = await fields(requested, { ...req.user, ...(req.user.role === "staff" && { id: String(slot.staff) }) }, !slot.service);
      if (bookings.length && (String(values.service || "") !== String(slot.service || "") || values.startsAt.getTime() !== slot.startsAt.getTime() || values.endsAt.getTime() !== endTime(slot).getTime() || values.capacity !== capacity(slot) || values.status !== publicStatus(slot))) v.fail("Booked availability cannot change its service, schedule, capacity or publication status. Cancel it and publish a replacement.", 409);
      await checkOverlap(slot.staff, values.startsAt, values.endsAt, slot._id, session);
      Object.assign(slot, values);
      const active = bookings.filter(item => ["Pending", "Approved"].includes(item.status));
      if (active.length) await Appointment.bulkWrite(active.map(booking => ({ updateOne: {
        filter: { _id: booking._id }, update: { $push: { notificationEvents: { $each: [event(booking.student, "Your appointment details changed. Check the updated location and instructions in My Appointments."), event(slot.staff, "Appointment location or instructions changed. Review the updated booking.")] } } },
      } })), { session });
      affected.push(...active.map(booking => String(booking.student)));
    }
    slot.revision = (slot.revision || 0) + 1;
    await slot.save({ session });
    return slot;
  });
  await notifyStudents(affected);
  res.json({ message: slot.status === "Cancelled" ? "Availability and affected bookings cancelled." : "Availability updated successfully.", slot });
};
exports.closeLegacy = async (req, res) => {
  const slot = await transact(async session => {
    const slot = await Slot.findOne({ _id: v.id(req.params.id), ...slotScope(req.user) }).session(session);
    if (!slot) v.fail("Availability not found", 404);
    slot.active = false; slot.status = slot.status === "Cancelled" ? "Cancelled" : "Closed";
    slot.revision = (slot.revision || 0) + 1; await slot.save({ session }); return slot;
  });
  res.json({ message: "Availability closed. Existing bookings remain unchanged.", slot });
};
exports.book = async (req, res) => {
  v.body(req.body, ["slot", "reason"]);
  const id = v.id(req.body.slot), reason = v.text(req.body.reason, "Reason", 2000);
  const appointment = await transact(async session => {
    // Updating the slot serializes capacity checks with all other booking, edit,
    // cancellation and close transactions without a separate cached seat count.
    const slot = await Slot.findOneAndUpdate({ _id: id, active: true, status: { $in: ["Published", null] }, startsAt: { $gt: new Date() } }, { $inc: { revision: 1 } }, { session, returnDocument: "after" });
    if (!slot) v.fail("This appointment time is unavailable", 409);
    if (!(await User.exists({ _id: slot.staff, role: "staff", active: { $ne: false }, approvalStatus: "approved" }).session(session))) v.fail("This appointment time is unavailable", 409);
    if (slot.service && !(await Service.exists({ _id: slot.service, active: { $ne: false } }).session(session))) v.fail("This service is unavailable", 409);
    if (await Appointment.exists({ slot: slot._id, student: req.user.id, status: { $in: occupiedStatuses } }).session(session)) v.fail("You already have a booking for this appointment", 409);
    const booked = await Appointment.countDocuments({ slot: slot._id, status: { $in: occupiedStatuses } }).session(session);
    if (booked >= capacity(slot)) v.fail("This appointment time is already booked. Choose another available time.", 409);
    return (await Appointment.create([{
      student: req.user.id, slot: slot._id, ...(capacity(slot) === 1 && { reservedSlot: slot._id }), activeReservation: true,
      staff: slot.staff, date: slot.startsAt, time: slot.startsAt.toISOString().slice(11,16), reason,
      history: [{ status: "Pending", actor: req.user.id, at: new Date() }],
      notificationEvents: [event(req.user.id, "Your appointment booking is pending approval."), event(slot.staff, "A student booked an appointment with you.", { title: "New appointment booking" }), require("../utils/notificationEvent").adminEvent("An appointment booking is awaiting review.", { title: "Appointment review required" })],
    }], { session }))[0];
  });
  await tryFlush(Appointment, req.user.id);
  res.status(201).json({ message: "Appointment booked successfully. Awaiting staff approval.", appointment: { _id: appointment._id, status: appointment.status } });
};
exports.review = async (req, res) => {
  v.body(req.body, ["status", "expectedStatus", "expectedUpdatedAt", "rejectionReason"]);
  const status = v.choice(req.body.status, Object.keys(transitions), "status");
  const expected = v.choice(req.body.expectedStatus, Object.keys(transitions), "expected status");
  if (!transitions[expected].includes(status)) v.fail("This status transition is not permitted", 409);
  const booking = await transact(async session => {
    const filter = { _id: v.id(req.params.id), ...(req.user.role === "student" ? { student: req.user.id } : slotScope(req.user)) };
    const item = await Appointment.findOne(filter).select("+notificationEvents").session(session);
    if (!item) v.fail("Record not found", 404);
    if (req.user.role === "student" && status !== "Cancelled") v.fail("Students may only cancel their own bookings", 403);
    if (req.body.expectedUpdatedAt !== undefined || req.user.role !== "admin") observed(item, req.body.expectedUpdatedAt);
    if (item.status !== expected) v.fail("This record changed. Refresh and try again.", 409);
    const rejectionReason = status === "Rejected" ? v.text(req.body.rejectionReason, "Rejection reason", 2000) : undefined;
    if (status === "Completed" && item.date > new Date()) v.fail("An appointment cannot be completed before it starts", 409);
    if (status === "Approved" && item.date <= new Date()) v.fail("A past appointment cannot be approved", 409);
    if (req.user.role === "student" && item.date <= new Date()) v.fail("Past bookings cannot be cancelled", 409);
    let slot;
    if (item.slot) {
      slot = await Slot.findOneAndUpdate({ _id: item.slot }, { $inc: { revision: 1 } }, { session, returnDocument: "after" });
      if (status === "Approved" && slot?.status === "Cancelled") v.fail("This availability was cancelled", 409);
    }
    item.status = status;
    if (rejectionReason) item.rejectionReason = rejectionReason;
    if (["Rejected", "Cancelled"].includes(status)) { item.reservedSlot = undefined; item.activeReservation = false; }
    item.history.push({ status, ...(rejectionReason && { reason: rejectionReason }), actor: req.user.id, at: new Date() });
    const schedule = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" }).format(item.date);
    const summary = `Appointment status: ${status}. ${slot?.serviceName || slot?.title || "Staff appointment"} · ${schedule} (Asia/Colombo)${slot?.location ? " · " + slot.location : ""}${rejectionReason ? ". Reason: " + rejectionReason : ""}`;
    item.notificationEvents = [...(item.notificationEvents || []), event(item.student, summary, { title: `Appointment ${status.toLowerCase()}` }), ...(item.staff ? [event(item.staff, `An appointment booking changed to ${status}.`)] : [])];
    await item.save({ session }); return item;
  });
  await tryFlush(Appointment, String(booking.student));
  const item = booking.toObject(); delete item.notificationEvents;
  res.json({ message: "Booking updated successfully.", item });
};
