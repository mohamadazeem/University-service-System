const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose"), jwt = require("jsonwebtoken");
const User = require("../models/user"), Complaint = require("../models/Complaint"), Service = require("../models/service"), Notification = require("../models/Notification");
const app = require("../app");
test("complaint assignment: admin oversight, assignee privacy, reassignment, notes and student notifications", { timeout: 150000 }, async () => {
  const prefix = "complaint-assignment-" + randomUUID(), users = [], complaints = [], services = [];
  let server;
  try {
    await require("../config/db")(); await Promise.all([User.init(), Complaint.init(), Notification.init(), Service.init()]);
    const account = async (role, suffix, department, approvalStatus = "approved") => {
      const user = await User.create({ name: prefix + suffix, email: prefix + suffix + "@example.test", password: "not-a-password-login-test", role, department, ...(role === "staff" && { approvalStatus }) });
      users.push(user._id); return { id: String(user._id), token: jwt.sign({ id: user._id, role: "admin" }, process.env.JWT_SECRET) };
    };
    const admin = await account("admin", "admin"), first = await account("staff", "first", "Library"), second = await account("staff", "second", "Library"), wrong = await account("staff", "wrong", "Registry"), pending = await account("staff", "pending", "Library", "pending"), student = await account("student", "student"), otherStudent = await account("student", "other-student");
    const service = await Service.create({ name: prefix, nameKey: prefix, department: "Library", description: "Test catalogue department" }); services.push(service._id);
    server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    const call = async (path, actor, method = "GET", data) => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api` + path, { method, headers: { "Content-Type": "application/json", ...(actor && { Authorization: "Bearer " + actor.token }) }, ...(data && { body: JSON.stringify(data) }) });
      return { code: res.status, ...await res.json() };
    };
    const submitted = await call("/complaints", student, "POST", { subject: prefix, description: "A private Library concern", department: "Library", priority: "Urgent", category: "General" });
    assert.equal(submitted.code, 201); const id = submitted.complaint._id; complaints.push(id);
    assert.equal((await Complaint.findById(id)).assignedStaff, null);
    for (const actor of [first,second,wrong]) {
      assert.equal((await call("/staff/complaints?q=" + prefix, actor)).total, 0);
      assert.equal((await call("/staff/complaints/" + id, actor)).code, 404);
      assert.equal((await call("/staff/complaints/" + id, actor, "PATCH", { status: "Resolved", expectedStatus: "Pending", response: "Unauthorized" })).code, 404);
      assert.equal((await call("/admin/complaints/overview", actor)).code, 403);
      const overview = await call("/staff/support-overview", actor);
      assert.deepEqual(Object.keys(overview).sort(), ["code","pendingBookings","upcomingBookings"]);
    }
    assert.equal((await call("/staff/complaints", pending)).code, 401);
    assert.equal((await call("/complaints/" + id, otherStudent)).code, 404);
    assert.equal((await call("/admin/complaints?q=" + prefix, admin)).total, 1);
    assert.equal((await call("/admin/complaints?assignment=unassigned&q=" + prefix, admin)).total, 1);
    let detail = await call("/admin/complaints/" + id, admin);
    const assignment = { assignedStaff: first.id, expectedUpdatedAt: detail.item.updatedAt };
    assert.equal((await call("/admin/complaints/" + id + "/assignment", first, "PATCH", assignment)).code, 403);
    assert.equal((await call("/admin/complaints/" + id + "/assignment", student, "PATCH", assignment)).code, 403);
    assert.equal((await call("/admin/complaints/" + id + "/assignment", admin, "PATCH", { ...assignment, assignedStaff: wrong.id })).code, 400);
    assert.equal((await call("/admin/complaints/" + id + "/assignment", admin, "PATCH", { ...assignment, assignedStaff: pending.id })).code, 400);
    const options = await call("/admin/complaint-staff?department=Library", admin);
    assert.ok(options.staff.some(user => user._id === first.id)); assert.ok(!options.staff.some(user => user._id === wrong.id || user._id === pending.id));
    assert.equal((await call("/admin/complaints/" + id + "/assignment", admin, "PATCH", assignment)).code, 200);
    assert.equal((await call("/admin/complaints/" + id + "/assignment", admin, "PATCH", assignment)).code, 409);
    let stored = await Complaint.findById(id);
    assert.equal(stored.status, "In Progress"); assert.equal(String(stored.assignedBy), admin.id); assert.ok(stored.assignedAt); assert.equal(stored.assignmentHistory.length, 1);
    assert.equal((await call("/staff/complaints?q=" + prefix, first)).total, 1);
    assert.equal((await call("/staff/complaints/" + id, second)).code, 404);
    assert.equal((await call("/staff/complaints?view=unassigned", first)).code, 403);
    assert.equal((await call("/staff/complaints/" + id, first, "PATCH", { assignedStaff: second.id })).code, 400);
    detail = await call("/staff/complaints/" + id, first);
    const update = { status: "In Progress", expectedStatus: "In Progress", expectedUpdatedAt: detail.item.updatedAt, response: "Investigating the concern", investigationNotes: "CONFIDENTIAL_INTERNAL_NOTE" };
    assert.equal((await call("/staff/complaints/" + id, first, "PATCH", update)).code, 200);
    const owner = await call("/complaints/" + id, student), ownList = await call("/complaints?q=" + prefix, student);
    assert.ok(!JSON.stringify(owner).includes("CONFIDENTIAL_INTERNAL_NOTE")); assert.ok(!JSON.stringify(ownList).includes("CONFIDENTIAL_INTERNAL_NOTE"));
    assert.equal(owner.item.response, update.response); assert.equal(owner.item.assignedStaff._id, first.id);
    detail = await call("/admin/complaints/" + id, admin);
    assert.equal(detail.item.investigationNotes, update.investigationNotes);
    assert.equal((await call("/admin/complaints/" + id + "/assignment", admin, "PATCH", { assignedStaff: second.id, expectedUpdatedAt: detail.item.updatedAt })).code, 200);
    assert.equal((await call("/staff/complaints/" + id, first)).code, 404);
    assert.equal((await call("/staff/complaints/" + id, first, "PATCH", update)).code, 404);
    assert.equal((await call("/staff/complaints?q=" + prefix, first)).total, 0);
    detail = await call("/staff/complaints/" + id, second);
    assert.equal((await call("/staff/complaints/" + id, second, "PATCH", { ...update, status: "Resolved", expectedUpdatedAt: detail.item.updatedAt, response: "The Library issue is resolved" })).code, 200);
    stored = await Complaint.findById(id); assert.equal(stored.status, "Resolved"); assert.equal(stored.assignmentHistory.length, 2);
    assert.equal((await call("/admin/complaints?status=Resolved&department=Library&priority=Urgent&q=" + prefix, admin)).total, 1);
    assert.equal((await call("/admin/complaints?from=2099-01-01&q=" + prefix, admin)).total, 0);
    assert.equal((await call("/admin/complaints?from=bad", admin)).code, 400);
    const overview = await call("/admin/complaints/overview", admin);
    assert.equal(overview.total, await Complaint.countDocuments({}));
    assert.equal(overview.unassigned, await Complaint.countDocuments({ assignedStaff: null }));
    assert.equal(overview.resolved, await Complaint.countDocuments({ status: "Resolved" }));
    assert.equal(overview.inProgress, await Complaint.countDocuments({ status: { $in: ["In Review", "In Progress"] } }));
    assert.ok(await Notification.exists({ user: student.id, message: /assigned to university staff/ }));
    assert.ok(await Notification.exists({ user: student.id, message: /^Complaint status: Resolved\./ }));
    assert.equal((await call("/complaints/" + id, student)).item.status, "Resolved");
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) { await Complaint.deleteMany({ _id: { $in: complaints } }); await Notification.deleteMany({ user: { $in: users } }); await User.deleteMany({ _id: { $in: users } }); await Service.deleteMany({ _id: { $in: services } }); }
    await mongoose.disconnect();
  }
});
