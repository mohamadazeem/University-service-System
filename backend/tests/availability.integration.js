const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose"), jwt = require("jsonwebtoken");
const User = require("../models/user"), Slot = require("../models/AppointmentSlot"), Appointment = require("../models/Appointment"), Service = require("../models/service"), Notification = require("../models/Notification");
const app = require("../app");
test("availability: transaction-safe capacity, schedules, student cancellation, ownership and notifications", { timeout: 180000 }, async () => {
  const prefix = "availability-it-" + randomUUID();
  const owned = { users: [], slots: [], services: [] };
  let server;
  try {
    await require("../config/db")();
    await Promise.all([User.init(), Slot.init(), Appointment.init(), Service.init(), Notification.init()]);
    const account = async (role, suffix, approvalStatus = "approved") => {
      const user = await User.create({ name: prefix + suffix, email: prefix + suffix + "@example.test", password: "not-a-login-test", role, ...(role === "staff" && { approvalStatus }) });
      owned.users.push(user._id); return { id: user._id, token: jwt.sign({ id: String(user._id), role: "admin" }, process.env.JWT_SECRET) };
    };
    const staff = await account("staff", "staff"), other = await account("staff", "other"), admin = await account("admin", "admin"), pending = await account("staff", "pending", "pending");
    const students = await Promise.all([1,2,3].map(index => account("student", "student" + index)));
    const service = await Service.create({ name: prefix, nameKey: prefix, department: "Student Services", description: "Availability integration test" }); owned.services.push(service._id);
    server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    const call = async (path, actor, method = "GET", body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api` + path, { method, headers: { "Content-Type": "application/json", ...(actor && { Authorization: "Bearer " + actor.token }) }, ...(body && { body: JSON.stringify(body) }) });
      return { code: response.status, ...await response.json() };
    };
    const start = new Date(Date.now() + 7 * 86400000); start.setUTCHours(6,0,0,0);
    const body = { service: String(service._id), title: prefix, description: "Discuss university services", startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(), building: "University Services Building", room: "Room 204", capacity: 2, durationMinutes: 20, instructions: "Bring your student ID", status: "Draft" };
    // The compact form needs only service, title and the start/end instants.
    const compactStart = new Date(start.getTime() + 5 * 86400000);
    const compact = { service: String(service._id), title: prefix + " compact", startsAt: compactStart.toISOString(), endsAt: new Date(+compactStart + 3600000).toISOString(), status: "Draft" };
    const compactResult = await call("/staff/appointment-slots", staff, "POST", compact);
    assert.equal(compactResult.code, 201); owned.slots.push(compactResult.slot._id);
    assert.equal(compactResult.slot.capacity, 1);
    assert.equal(compactResult.slot.category, service.department);
    assert.equal(compactResult.slot.description, ""); assert.equal(compactResult.slot.location, "");
    const relocated = await call("/staff/appointment-slots/" + compactResult.slot._id, staff, "PATCH", { location: "Online meeting", expectedUpdatedAt: compactResult.slot.updatedAt });
    assert.equal(relocated.code, 200); assert.equal(relocated.slot.location, "Online meeting");
    assert.equal(relocated.slot.capacity, 1);
    for (const change of [{ startsAt: "2020-01-01T00:00:00Z" }, { endsAt: compact.startsAt }, { endsAt: new Date(+compactStart - 60000).toISOString() }])
      assert.equal((await call("/staff/appointment-slots", staff, "POST", { ...compact, ...change })).code, 400);
    assert.equal((await call("/staff/appointment-slots/" + compactResult.slot._id, staff, "PATCH", { status: "Published", expectedUpdatedAt: relocated.slot.updatedAt })).code, 200);
    assert.equal((await call("/appointments", students[0], "POST", { slot: compactResult.slot._id, reason: "Compact booking" })).code, 201);
    assert.equal((await call("/appointments", students[1], "POST", { slot: compactResult.slot._id, reason: "Must not double book" })).code, 409);
    assert.equal((await call("/staff/appointment-slots", null)).code, 401);
    assert.equal((await call("/staff/appointment-slots", students[0], "POST", body)).code, 403);
    assert.equal((await call("/staff/appointment-slots", pending, "POST", body)).code, 401);
    for (const change of [{ endsAt: body.startsAt }, { capacity: 0 }, { startsAt: "2020-01-01T01:00:00Z" }, { staff: String(other.id) }, { service: String(staff.id) }]) assert.equal((await call("/staff/appointment-slots", staff, "POST", { ...body, ...change })).code, 400);
    const created = await call("/staff/appointment-slots", staff, "POST", body);
    assert.equal(created.code, 201); owned.slots.push(created.slot._id); const id = created.slot._id;
    assert.equal((await Slot.findById(id)).building, body.building);
    assert.equal((await call("/appointments/availability?q=" + prefix, students[0])).total, 0);
    assert.equal((await call("/staff/appointment-slots?q=" + prefix, other)).total, 0);
    assert.equal((await call("/staff/appointment-slots/" + id, other)).code, 404);
    assert.equal((await call("/staff/appointment-slots/" + id, other, "PATCH", { action: "cancel", expectedUpdatedAt: created.slot.updatedAt })).code, 404);
    assert.equal((await call("/staff/appointment-slots/" + id, staff, "PATCH", { status: "Published", expectedUpdatedAt: created.slot.updatedAt })).code, 200);
    assert.equal((await call("/staff/appointment-slots/" + id, staff, "PATCH", { title: "Stale", expectedUpdatedAt: created.slot.updatedAt })).code, 409);
    const discovered = await call("/appointments/availability?q=" + prefix, students[0]);
    assert.equal(discovered.total, 1); assert.equal(discovered.items[0].remaining, 2); assert.match(discovered.items[0].location, /Room 204/);
    assert.equal((await call("/appointments/availability?date=" + body.startsAt.slice(0,10) + "&service=" + service._id, students[0])).items.some(slot => slot._id === id), true);
    const overlap = { ...body, status: "Published", startsAt: new Date(start.getTime()+1800000).toISOString(), endsAt: new Date(start.getTime()+5400000).toISOString() };
    assert.equal((await call("/staff/appointment-slots", staff, "POST", overlap)).code, 409);
    const races = await Promise.all(students.map(student => call("/appointments", student, "POST", { slot: id, reason: "Capacity race" })));
    assert.deepEqual(races.map(result => result.code).sort(), [201,201,409]);
    assert.equal(await Appointment.countDocuments({ slot: id, status: "Pending" }), 2);
    const winnerIndex = races.findIndex(result => result.code === 201), winner = students[winnerIndex], bookingId = races[winnerIndex].appointment._id;
    assert.equal((await call("/appointments", winner, "POST", { slot: id, reason: "Duplicate" })).code, 409);
    assert.equal((await call("/appointments/availability?q=" + prefix, students[0])).total, 0);
    let details = await call("/staff/appointment-slots/" + id, staff);
    assert.equal(details.bookings.length, 2); assert.equal(details.slot.remaining, 0);
    assert.ok(details.bookings.every(item => item.student.password === undefined));
    assert.equal((await call("/admin/appointment-slots/" + id, admin)).code, 200);
    // The central Admin page receives slot and account details and reviews bookings.
    const adminList = await call("/admin/appointments?q=" + bookingId, admin);
    assert.equal(adminList.code, 200);
    assert.equal(adminList.items.length, 1);
    assert.equal(adminList.items[0].slot.serviceName, service.name);
    assert.equal(adminList.items[0].slot.location, "University Services Building / Room 204");
    assert.equal(adminList.items[0].slot.startsAt, body.startsAt);
    assert.equal(adminList.items[0].slot.endsAt, body.endsAt);
    assert.ok(adminList.items[0].staff.name);
    assert.ok(adminList.items[0].student.email);
    const otherWinnerIndex = races.findIndex((result, index) => result.code === 201 && index !== winnerIndex);
    const reviewId = races[otherWinnerIndex].appointment._id;
    const review = await Appointment.findById(reviewId);
    const approval = { status: "Approved", expectedStatus: "Pending", expectedUpdatedAt: review.updatedAt.toISOString() };
    assert.equal((await call("/admin/appointments/" + reviewId, admin, "PATCH", approval)).code, 200);
    assert.equal((await call("/admin/appointments/" + reviewId, admin, "PATCH", approval)).code, 409);
    const approved = await Appointment.findById(reviewId);
    assert.equal((await call("/admin/appointments/" + reviewId, admin, "PATCH", { status: "Rejected", expectedStatus: "Approved", expectedUpdatedAt: approved.updatedAt.toISOString() })).code, 200);
    assert.equal((await call("/appointments", students[otherWinnerIndex], "POST", { slot: id, reason: "Rebook capacity released by admin rejection" })).code, 201);
    assert.equal((await call("/staff/appointment-slots/" + id, staff, "PATCH", { startsAt: new Date(start.getTime()+60000).toISOString(), expectedUpdatedAt: details.slot.updatedAt })).code, 409);
    let booking = await Appointment.findById(bookingId);
    const cancellation = { status: "Cancelled", expectedStatus: "Pending", expectedUpdatedAt: booking.updatedAt.toISOString() };
    const nonOwner = students.find(student => String(student.id) !== String(winner.id));
    assert.equal((await call("/appointments/" + bookingId, nonOwner, "PATCH", cancellation)).code, 404);
    assert.equal((await call("/appointments/" + bookingId, winner, "PATCH", { ...cancellation, status: "Approved" })).code, 403);
    assert.equal((await call("/appointments/" + bookingId, winner, "PATCH", cancellation)).code, 200);
    assert.equal((await call("/appointments/availability?q=" + prefix, winner)).items[0].remaining, 1);
    assert.equal((await call("/appointments", winner, "POST", { slot: id, reason: "Rebook released capacity" })).code, 201);
    details = await call("/staff/appointment-slots/" + id, staff);
    assert.equal((await call("/staff/appointment-slots/" + id, staff, "PATCH", { building: "New Student Centre", room: "Office 8", instructions: "Updated directions", expectedUpdatedAt: details.slot.updatedAt })).code, 200);
    assert.ok(await Notification.exists({ user: winner.id, message: /details changed/ }));
    const studentBookings = await call("/appointments", winner);
    assert.equal(studentBookings.items[0].slot.location, "New Student Centre / Office 8");
    details = await call("/staff/appointment-slots/" + id, staff);
    assert.equal((await call("/admin/appointment-slots/" + id, admin, "PATCH", { action: "cancel", expectedUpdatedAt: details.slot.updatedAt })).code, 200);
    assert.equal(await Appointment.countDocuments({ slot: id, status: { $in: ["Pending", "Approved"] } }), 0);
    assert.equal((await Slot.findById(id)).status, "Cancelled");
    assert.ok(await Notification.exists({ user: winner.id, message: /availability was cancelled/ }));
    assert.equal((await call("/appointments", winner, "POST", { slot: id, reason: "Cancelled slot" })).code, 409);
    // Concurrent overlapping creates must serialize even when startsAt differs.
    const anotherStart = new Date(start.getTime() + 86400000);
    const schedules = await Promise.all([0, 15].map(minutes => call("/staff/appointment-slots", staff, "POST", { ...body, startsAt: new Date(anotherStart.getTime()+minutes*60000).toISOString(), endsAt: new Date(anotherStart.getTime()+(minutes+60)*60000).toISOString() })));
    for (const result of schedules) if (result.code === 201) owned.slots.push(result.slot._id);
    assert.deepEqual(schedules.map(result => result.code).sort(), [201,409]);
    // Pre-existing single-capacity documents have a 30 minute effective window.
    const legacyId = new mongoose.Types.ObjectId(); owned.slots.push(legacyId);
    await Slot.collection.insertOne({ _id: legacyId, staff: other.id, startsAt: new Date(start.getTime()+2*86400000), active: true, location: "Legacy office" });
    assert.equal((await call("/appointments", winner, "POST", { slot: String(legacyId), reason: "Legacy compatibility" })).code, 201);
    const legacy = await Appointment.findOne({ slot: legacyId });
    assert.equal(String(legacy.reservedSlot), String(legacyId));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await Appointment.deleteMany({ slot: { $in: owned.slots } });
      await Slot.deleteMany({ _id: { $in: owned.slots } });
      await Notification.deleteMany({ user: { $in: owned.users } });
      await Service.deleteMany({ _id: { $in: owned.services } });
      await User.deleteMany({ _id: { $in: owned.users } });
    }
    await mongoose.disconnect();
  }
});
