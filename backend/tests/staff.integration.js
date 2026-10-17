// Uses only uniquely named fixtures and removes their IDs. No collection resets.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Service = require("../models/service");
const Request = require("../models/Request");
const Notification = require("../models/Notification");
const app = require("../app");

test("MongoDB: four-field staff registration, approval and assigned-request processing", { timeout: 120000 }, async () => {
  const prefix = "staff-it-" + randomUUID();
  const password = randomUUID() + "Aa1!";
  const owned = { users: [], services: [], requests: [] };
  let server;
  try {
    await require("../config/db")();
    await Promise.all([User.init(), Service.init(), Request.init(), Notification.init()]);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, method = "GET", data, token) => {
      const response = await fetch(origin + "/api" + path, {
        method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
        ...(data !== undefined && { body: JSON.stringify(data) }),
      });
      return { status: response.status, ...await response.json() };
    };
    const department = prefix + " Registry", otherDepartment = prefix + " Library";
    const hash = await bcrypt.hash(password, 12);
    const admin = await User.create({ name: prefix + " Admin", email: prefix + "-admin@example.test", password: hash, role: "admin" });
    owned.users.push(admin._id);
    const adminLogin = await call("/auth/login", "POST", { email: admin.email, password, portal: "admin" });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.token;
    const student = await call("/auth/register", "POST", { name: prefix + " Student", email: prefix + "-student@example.test", password, studentId: prefix, role: "admin" });
    assert.equal(student.status, 201); assert.equal(student.user.role, "student");
    owned.users.push(student.user.id);
    const studentLogin = await call("/auth/login", "POST", { email: student.user.email, password, portal: "student" });
    assert.equal(studentLogin.status, 200);
    const studentToken = studentLogin.token;
    const services = [];
    for (const dept of [department, otherDepartment]) {
      const service = await Service.create({ name: dept, nameKey: dept.toLowerCase(), department: dept, description: "Temporary all-department staff test" });
      owned.services.push(service._id); services.push(service);
    }
    const email = prefix + "@example.test", staffId = prefix.toUpperCase();
    const registration = { name: prefix + " Lecturer", email, password, staffId: " " + staffId.toLowerCase() + " " };
    for (const key of ["name", "email", "staffId", "password"])
      assert.equal((await call("/auth/staff/register", "POST", { ...registration, [key]: undefined })).status, 400);
    const registered = await call("/auth/staff/register", "POST", { ...registration, role: "admin", approvalStatus: "approved", reviewedBy: admin._id });
    assert.equal(registered.status, 201); assert.equal(registered.token, undefined);
    const staff = await User.findOne({ email }).select("+password");
    owned.users.push(staff._id);
    assert.equal(staff.role, "staff"); assert.equal(staff.approvalStatus, "pending"); assert.equal(staff.reviewedBy, undefined);
    assert.equal(staff.staffId, staffId); assert.equal(staff.department, undefined);
    assert.ok(await bcrypt.compare(password, staff.password));
    assert.equal((await call("/auth/staff/register", "POST", registration)).status, 409);
    assert.equal((await call("/auth/staff/register", "POST", { ...registration, email: prefix + "-duplicate@example.test" })).status, 409);
    const duplicateId = new mongoose.Types.ObjectId(); owned.users.push(duplicateId);
    await assert.rejects(User.create({ _id: duplicateId, name: "Duplicate staff ID", email: prefix + "-index@example.test", password: hash, role: "staff", staffId: staffId.toLowerCase() }), { code: 11000 });
    const pendingLogin = await call("/auth/login", "POST", { email, password, portal: "staff" });
    assert.equal(pendingLogin.status, 403); assert.match(pendingLogin.message, /awaiting administrator approval/);
    const oldToken = jwt.sign({ id: staff._id, role: "admin", approvalStatus: "approved", department: otherDepartment }, process.env.JWT_SECRET);
    assert.equal((await call("/staff/requests", "GET", undefined, oldToken)).status, 401);
    assert.equal((await call("/admin/staff-registrations", "GET", undefined, studentToken)).status, 403);
    const list = await call("/admin/staff-registrations?q=" + prefix + "&approvalStatus=pending", "GET", undefined, adminToken);
    assert.equal(list.status, 200); assert.equal(list.total, 1); assert.equal(list.items[0].password, undefined);
    const getStaff = () => call("/admin/staff-registrations/" + staff._id, "GET", undefined, adminToken);
    const details = await getStaff();
    const review = { approvalStatus: "approved", expectedStatus: "pending", expectedUpdatedAt: details.user.updatedAt };
    const approved = await call("/admin/staff-registrations/" + staff._id, "PATCH", review, adminToken);
    assert.equal(approved.status, 200); assert.equal(approved.user.password, undefined);
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", review, adminToken)).status, 409);
    const history = await getStaff();
    assert.equal(history.user.approvalHistory.length, 1); assert.equal(history.user.reviewedBy, admin._id.toString());
    const staffLogin = await call("/auth/login", "POST", { email, password, portal: "staff" });
    assert.equal(staffLogin.status, 200); assert.equal(staffLogin.user.department, undefined);
    const staffToken = staffLogin.token;
    const baseline = await call("/staff/dashboard", "GET", undefined, staffToken);
    for (const path of ["/admin/users", "/admin/services", "/admin/requests", "/admin/staff-registrations"])
      assert.equal((await call(path, "GET", undefined, staffToken)).status, 403);
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", review, staffToken)).status, 403);
    const requests = [];
    for (const service of services) {
      const response = await call("/requests", "POST", { serviceId: service._id, studentId: prefix, description: "Department request", priority: "Urgent" }, studentToken);
      assert.equal(response.status, 201); owned.requests.push(response.request._id); requests.push(response.request);
    }
    const legacyRequest = await Request.create({ student: student.user.id, studentId: prefix, service: services[0].name, description: "Legacy unlinked request" });
    owned.requests.push(legacyRequest._id);
    const ownId = requests[0]._id, otherId = requests[1]._id;
    // Student submissions start unassigned; staff cannot discover or edit them.
    assert.equal((await call("/staff/requests?q=" + prefix, "GET", undefined, staffToken)).total, 0);
    assert.equal((await call("/staff/dashboard", "GET", undefined, staffToken)).total, 0);
    for (const id of [ownId, otherId, legacyRequest._id]) {
      assert.equal((await call("/staff/requests/" + id, "GET", undefined, staffToken)).status, 404);
      assert.equal((await call("/staff/requests/" + id, "PATCH", { staffComment: "Unauthorized" }, staffToken)).status, 404);
      assert.equal((await call("/admin/requests/" + id, "GET", undefined, adminToken)).status, 200);
    }
    // Assignment is made through the existing administrator endpoint.
    for (const id of [ownId, otherId]) {
      assert.equal((await call("/admin/requests/" + id, "PATCH", { assignedStaff: staff._id.toString() }, adminToken)).status, 200);
    }
    const mine = await call("/staff/requests?q=" + prefix, "GET", undefined, staffToken);
    assert.equal(mine.status, 200); assert.equal(mine.total, 2);
    assert.ok(mine.items.every(row => row.assignedStaff._id === staff._id.toString()));
    assert.equal(mine.items.find(row => row._id === otherId).serviceDetails.department, otherDepartment);
    const filtered = await call("/staff/requests?department=" + encodeURIComponent(otherDepartment), "GET", undefined, staffToken);
    assert.equal(filtered.total, 1); assert.equal(filtered.items[0]._id, otherId);
    const adminFiltered = await call("/admin/requests?q=" + prefix, "GET", undefined, adminToken);
    assert.equal(adminFiltered.total, 3);
    const dashboard = await call("/staff/dashboard", "GET", undefined, staffToken);
    assert.equal(dashboard.total, baseline.total + 2); assert.equal(dashboard.counts.Pending, baseline.counts.Pending + 2);
    assert.equal((await call("/staff/requests?status=Pending&priority=Urgent&q=" + encodeURIComponent(services[1].name), "GET", undefined, staffToken)).total, 1);
    const page = await call("/staff/requests?q=" + prefix + "&limit=1&page=2&sort=createdAt&order=asc", "GET", undefined, staffToken);
    assert.equal(page.total, 2); assert.equal(page.page, 2); assert.equal(page.items.length, 1);
    assert.equal((await call("/staff/requests/" + ownId, "GET", undefined, staffToken)).status, 200);
    assert.equal((await call("/staff/requests/" + otherId, "PATCH", { status: "Processing", expectedStatus: "Pending" }, staffToken)).status, 200);
    for (const field of ["student", "service", "serviceRef", "department", "assignedStaff", "reviewedBy"])
      assert.equal((await call("/staff/requests/" + ownId, "PATCH", { [field]: otherId }, staffToken)).status, 400);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Completed", expectedStatus: "Pending" }, staffToken)).status, 409);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Processing", expectedStatus: "Pending", staffComment: "Reviewed by department" }, staffToken)).status, 200);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Approved", expectedStatus: "Pending" }, staffToken)).status, 409);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Completed", expectedStatus: "Processing" }, staffToken)).status, 200);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Pending", expectedStatus: "Completed" }, staffToken)).status, 409);
    const tracked = await call("/requests/my", "GET", undefined, studentToken);
    assert.equal(tracked.requests.find((r) => r._id === ownId).status, "Completed");
    const secondStudent = await User.create({ name: prefix + " Second student", email: prefix + "-second@example.test", password: hash, role: "student", studentId: prefix + "2" });
    owned.users.push(secondStudent._id);
    const privateRequest = await Request.create({ student: secondStudent._id, studentId: prefix + "2", serviceRef: services[1]._id, service: services[1].name, description: "Another student's request" });
    owned.requests.push(privateRequest._id);
    const secondToken = jwt.sign({ id: secondStudent._id }, process.env.JWT_SECRET);
    const firstMine = await call("/requests/my?student=" + secondStudent._id, "GET", undefined, studentToken);
    assert.equal(firstMine.requests.length, 3); assert.ok(firstMine.requests.every((r) => r.student === student.user.id));
    const secondMine = await call("/requests/my?student=" + student.user.id, "GET", undefined, secondToken);
    assert.equal(secondMine.requests.length, 1); assert.equal(secondMine.requests[0]._id, privateRequest._id.toString());
    assert.equal((await call("/staff/requests/" + ownId, "GET", undefined, secondToken)).status, 403);
    assert.equal((await call("/staff/requests/" + privateRequest._id, "GET", undefined, staffToken)).status, 404);
    assert.equal((await Notification.countDocuments({ user: student.user.id })) > 0, true);
    assert.equal((await call("/admin/requests/" + otherId, "GET", undefined, adminToken)).status, 200);
    assert.equal((await call("/admin/requests/" + otherId, "PATCH", { status: "Approved", expectedStatus: "Processing" }, adminToken)).status, 200);
    const beforeReject = await getStaff();
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", {
      approvalStatus: "rejected", expectedStatus: "approved", expectedUpdatedAt: beforeReject.user.updatedAt,
    }, adminToken)).status, 200);
    assert.equal((await call("/auth/me", "GET", undefined, staffToken)).status, 401);
    assert.equal((await call("/staff/requests", "GET", undefined, staffToken)).status, 401);
    assert.match((await call("/auth/login", "POST", { email, password })).message, /rejected/);
    const rejected = await getStaff();
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", {
      approvalStatus: "approved", expectedStatus: "rejected", expectedUpdatedAt: rejected.user.updatedAt,
    }, adminToken)).status, 200);
    const reopened = await call("/staff/requests?q=" + prefix, "GET", undefined, staffToken);
    assert.equal(reopened.total, 2);
    assert.equal((await call("/staff/requests/" + ownId, "GET", undefined, staffToken)).status, 200);
    await User.updateOne({ _id: staff._id }, { $set: { active: false } });
    assert.equal((await call("/auth/login", "POST", { email, password })).status, 401);
    assert.equal((await call("/auth/me", "GET", undefined, staffToken)).status, 401);
    // Raw collection insertion simulates an old account without new schema fields.
    const legacyId = new mongoose.Types.ObjectId(); owned.users.push(legacyId);
    await User.collection.insertOne({ _id: legacyId, name: "Legacy staff", email: prefix + "-legacy@example.test", role: "staff", password: hash, createdAt: new Date() });
    assert.equal((await call("/auth/login", "POST", { email: prefix + "-legacy@example.test", password })).status, 403);
    const legacyList = await call("/admin/staff-registrations?q=" + prefix + "-legacy&approvalStatus=pending", "GET", undefined, adminToken);
    assert.equal(legacyList.total, 1);
    assert.equal((await call("/admin/staff-registrations/" + legacyId, "PATCH", {
      approvalStatus: "approved", expectedStatus: "pending", expectedUpdatedAt: null,
    }, adminToken)).status, 200);
    const legacyLogin = await call("/auth/login", "POST", { email: prefix + "-legacy@example.test", password, portal: "staff" });
    assert.equal(legacyLogin.status, 200);
    assert.equal((await call("/staff/requests/" + otherId, "GET", undefined, legacyLogin.token)).status, 404);
    assert.equal((await call("/admin/requests/" + otherId, "PATCH", { assignedStaff: legacyId.toString() }, adminToken)).status, 200);
    assert.equal((await call("/staff/requests/" + otherId, "GET", undefined, legacyLogin.token)).status, 200);
    // Reactivating the former assignee must not restore access after reassignment.
    await User.updateOne({ _id: staff._id }, { $set: { active: true } });
    assert.equal((await call("/staff/requests/" + otherId, "GET", undefined, staffToken)).status, 404);
    assert.equal((await call("/staff/requests/" + otherId, "PATCH", { staffComment: "Stale assignee" }, staffToken)).status, 404);
    assert.equal((await call("/staff/dashboard", "GET", undefined, staffToken)).total, 1);
    assert.equal((await call("/admin/requests/" + otherId, "PATCH", { assignedStaff: null }, adminToken)).status, 200);
    assert.equal((await call("/staff/requests/" + otherId, "GET", undefined, legacyLogin.token)).status, 404);
    assert.equal((await call("/admin/requests?q=" + prefix, "GET", undefined, adminToken)).total, 4);
    console.log("Verified four-field staff registration, approval, audit history, student/Admin compatibility and assignment-only access; pre-existing records preserved.");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      for (const id of owned.requests) await Request.deleteOne({ _id: id });
      for (const id of owned.services) await Service.deleteOne({ _id: id });
      for (const id of owned.users) {
        await Notification.deleteMany({ user: id });
        await User.deleteOne({ _id: id });
      }
    }
    await mongoose.disconnect();
  }
});
