// Uses uniquely named fixtures and deletes only records created by this test.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Appointment = require("../models/Appointment");
const Slot = require("../models/AppointmentSlot");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const app = require("../app");

test("staff support: persistent booking and complaint lifecycles, concurrency, privacy and overview", { timeout: 120000 }, async () => {
  const prefix = "support-staff-" + randomUUID();
  const owned = { users: [], slots: [], bookings: [], complaints: [] };
  let server;
  try {
    await require("../config/db")();
    await Promise.all([User.init(), Appointment.init(), Slot.init(), Complaint.init(), Notification.init()]);
    const account = async (role, suffix, approvalStatus) => {
      const user = await User.create({ name: prefix + " " + suffix, email: prefix + suffix + "@example.test", password: "unused-test-hash", role, approvalStatus, studentId: role === "student" ? prefix + suffix : undefined });
      owned.users.push(user._id);
      return { user, token: jwt.sign({ id: String(user._id), role: "admin" }, process.env.JWT_SECRET, { expiresIn: "5m" }) };
    };
    const admin = await account("admin", "admin");
    const staff = await account("staff", "staff", "approved");
    const other = await account("staff", "other", "approved");
    const pending = await account("staff", "pending", "pending");
    const student = await account("student", "student");
    const another = await account("student", "another");
    server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (path, actor, method = "GET", body) => {
      const response = await fetch(origin + path, { method, headers: { "Content-Type": "application/json", ...(actor && { Authorization: "Bearer " + actor.token }) }, ...(body && { body: JSON.stringify(body) }) });
      return { code: response.status, ...await response.json() };
    };
    for (const path of ["/staff/bookings", "/staff/complaints", "/staff/support-overview"]) {
      assert.equal((await call(path)).code, 401);
      assert.equal((await call(path, student)).code, 403);
      assert.equal((await call(path, admin)).code, 403);
      assert.equal((await call(path, pending)).code, 401);
    }
    const future = new Date(Date.now() + 86400000).toISOString();
    const published = await call("/admin/appointment-slots", admin, "POST", { staff: String(staff.user._id), startsAt: future, location: "Registry Office 12" });
    assert.equal(published.code, 201);
    owned.slots.push(published.slot._id);
    assert.equal((await call("/admin/appointment-slots", admin, "POST", { staff: String(staff.user._id), startsAt: future })).code, 409);
    const attempts = await Promise.all([student, another].map(actor => call("/appointments", actor, "POST", { slot: published.slot._id, reason: prefix + " appointment" })));
    assert.deepEqual(attempts.map(row => row.code).sort(), [201, 409]);
    assert.match(attempts.find(row => row.code === 409).message, /already booked/);
    const winner = attempts[0].code === 201 ? student : another;
    const bookingId = attempts.find(row => row.code === 201).appointment._id;
    owned.bookings.push(bookingId);
    assert.equal(await Appointment.countDocuments({ reservedSlot: published.slot._id }), 1);
    assert.equal((await call("/staff/bookings?q=" + prefix, other)).total, 0);
    assert.equal((await call("/staff/bookings/" + bookingId, other)).code, 404);
    let detail = await call("/staff/bookings/" + bookingId, staff);
    assert.equal(detail.item.slot.location, "Registry Office 12");
    assert.equal(detail.item.student.password, undefined);
    const review = { status: "Approved", expectedStatus: "Pending", expectedUpdatedAt: detail.item.updatedAt };
    assert.equal((await call("/staff/bookings/" + bookingId, other, "PATCH", review)).code, 404);
    assert.equal((await call("/staff/bookings/" + bookingId, staff, "PATCH", { ...review, staff: String(other.user._id) })).code, 400);
    assert.equal((await call("/staff/bookings/" + bookingId, staff, "PATCH", review)).code, 200);
    assert.equal((await Appointment.findById(bookingId)).status, "Approved");
    assert.equal((await call("/staff/bookings?view=upcoming&q=" + prefix, staff)).total, 1);
    detail = await call("/staff/bookings/" + bookingId, staff);
    assert.equal((await call("/staff/bookings/" + bookingId, staff, "PATCH", { status: "Completed", expectedStatus: "Approved", expectedUpdatedAt: detail.item.updatedAt })).code, 409);
    assert.equal((await call("/staff/bookings/" + bookingId, staff, "PATCH", { status: "Cancelled", expectedStatus: "Approved", expectedUpdatedAt: detail.item.updatedAt })).code, 200);
    assert.equal((await Appointment.findById(bookingId)).reservedSlot, undefined);
    assert.equal((await call("/staff/bookings/" + bookingId, staff, "PATCH", review)).code, 409);
    let rebook = await call("/appointments", winner, "POST", { slot: published.slot._id, reason: prefix + " rebooking" });
    assert.equal(rebook.code, 201); owned.bookings.push(rebook.appointment._id);
    detail = await call("/staff/bookings/" + rebook.appointment._id, staff);
    assert.equal((await call("/staff/bookings/" + rebook.appointment._id, staff, "PATCH", { status: "Rejected", rejectionReason: "Please choose another appointment time.", expectedStatus: "Pending", expectedUpdatedAt: detail.item.updatedAt })).code, 200);
    assert.equal((await Appointment.findById(rebook.appointment._id)).reservedSlot, undefined);
    await call("/admin/appointment-slots/" + published.slot._id, admin, "DELETE");
    assert.equal((await call("/appointments", winner, "POST", { slot: published.slot._id, reason: "Closed time" })).code, 409);
    const past = await Appointment.create({ student: student.user._id, staff: staff.user._id, date: new Date(Date.now() - 86400000), time: "09:00", reason: prefix, status: "Approved" });
    owned.bookings.push(past._id);
    assert.equal((await call("/staff/bookings/" + past._id, staff, "PATCH", { status: "Completed", expectedStatus: "Approved", expectedUpdatedAt: past.updatedAt.toISOString() })).code, 200);
    assert.equal((await Appointment.findById(past._id)).status, "Completed");

    for (const fields of [{ priority: "Critical" }, { category: "Private arbitrary category" }, { student: String(another.user._id) }]) {
      assert.equal((await call("/complaints", student, "POST", { subject: prefix, description: "Confidential concern", ...fields })).code, 400);
    }
    const submitted = await call("/complaints", student, "POST", { subject: prefix, description: "Confidential concern", priority: "High", category: "Facilities" });
    assert.equal(submitted.code, 201); owned.complaints.push(submitted.complaint._id);
    const complaintId = submitted.complaint._id;
    assert.equal((await call("/complaints?q=" + prefix, another)).total, 0);
    assert.equal((await call("/staff/complaints/" + complaintId, student)).code, 403);
    assert.equal((await call("/staff/complaints/" + complaintId, staff)).code, 404);
    const unassigned = await Complaint.findById(complaintId);
    assert.equal((await call("/admin/complaints/" + complaintId + "/assignment", admin, "PATCH", { assignedStaff: String(staff.user._id), expectedUpdatedAt: unassigned.updatedAt.toISOString() })).code, 200);
    assert.equal((await call("/staff/complaints/" + complaintId, other)).code, 404);
    const summary = await call("/staff/complaints?q=" + prefix + "&priority=High&category=Facilities", staff);
    assert.equal(summary.total, 1);
    assert.equal(summary.items[0].description, undefined);
    assert.equal(summary.items[0].history, undefined);
    detail = await call("/staff/complaints/" + complaintId, staff);
    assert.equal(detail.item.description, "Confidential concern");
    const patch = { status: "In Progress", expectedStatus: "In Progress", expectedUpdatedAt: detail.item.updatedAt, response: "Investigating the concern", priority: "Urgent" };
    const edits = await Promise.all([staff, staff].map(actor => call("/staff/complaints/" + complaintId, actor, "PATCH", patch)));
    assert.deepEqual(edits.map(row => row.code).sort(), [200, 409]);
    let stored = await Complaint.findById(complaintId);
    assert.equal(stored.priority, "Urgent");
    assert.equal(stored.history.filter(entry => entry.kind !== "assignment").length, 1);
    assert.equal(stored.history.find(entry => entry.kind !== "assignment").response, patch.response);
    assert.equal((await call("/staff/complaints/" + complaintId, staff, "PATCH", { ...patch, status: "Resolved", expectedStatus: "In Progress", expectedUpdatedAt: stored.updatedAt.toISOString(), response: "" })).code, 400);
    assert.equal((await call("/staff/complaints/" + complaintId, staff, "PATCH", { ...patch, status: "In Progress", expectedStatus: "In Progress", expectedUpdatedAt: stored.updatedAt.toISOString(), response: "Progress update" })).code, 200);
    stored = await Complaint.findById(complaintId);
    const overview = await call("/staff/support-overview", staff);
    assert.equal(overview.pendingBookings, await Appointment.countDocuments({ staff: staff.user._id, status: "Pending" }));
    assert.equal(overview.upcomingBookings, await Appointment.countDocuments({ staff: staff.user._id, status: "Approved", date: { $gt: new Date() } }));
    assert.equal(overview.unresolvedComplaints, undefined);
    assert.equal(overview.highPriorityComplaints, undefined);
    assert.equal((await call("/staff/complaints/" + complaintId, staff, "PATCH", { status: "Resolved", expectedStatus: "In Progress", expectedUpdatedAt: stored.updatedAt.toISOString(), response: "Issue fixed", priority: "High" })).code, 200);
    stored = await Complaint.findById(complaintId);
    assert.deepEqual(stored.history.filter(row => row.response).map(row => row.response), ["Investigating the concern", "Progress update", "Issue fixed"]);
    assert.equal(stored.status, "Resolved");
    const studentView = await call("/complaints?q=" + prefix, student);
    assert.equal(studentView.items[0].response, "Issue fixed");
    assert.equal(studentView.items[0].history.filter(row => row.response).length, 3);
    assert.equal((await call("/staff/complaints?view=unresolved&q=" + prefix, staff)).total, 0);
    assert.equal((await call("/staff/complaints/" + complaintId, staff, "PATCH", { ...patch, expectedStatus: "Resolved", expectedUpdatedAt: stored.updatedAt.toISOString() })).code, 409);
    // Legacy complaints retain their previous response when first edited.
    const legacy = await Complaint.create({ student: student.user._id, subject: prefix + " legacy", description: "Legacy", response: "Existing response" });
    owned.complaints.push(legacy._id);
    assert.equal((await call("/admin/complaints/" + legacy._id + "/assignment", admin, "PATCH", { assignedStaff: String(staff.user._id), expectedUpdatedAt: legacy.updatedAt.toISOString() })).code, 200);
    const assignedLegacy = await Complaint.findById(legacy._id);
    assert.equal((await call("/staff/complaints/" + legacy._id, staff, "PATCH", { status: "In Progress", expectedStatus: "In Progress", expectedUpdatedAt: assignedLegacy.updatedAt.toISOString(), response: "Follow-up" })).code, 200);
    assert.deepEqual((await Complaint.findById(legacy._id)).history.filter(row => row.response).map(row => row.response), ["Existing response", "Follow-up"]);
    assert.ok(await Notification.exists({ user: student.user._id }));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await Appointment.deleteMany({ _id: { $in: owned.bookings } });
      await Slot.deleteMany({ _id: { $in: owned.slots } });
      await Complaint.deleteMany({ _id: { $in: owned.complaints } });
      await Notification.deleteMany({ user: { $in: owned.users } });
      await User.deleteMany({ _id: { $in: owned.users } });
    }
    await mongoose.disconnect();
  }
});
