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

test("MongoDB: staff self-registration, admin review, revocation and department isolation", { timeout: 120000 }, async () => {
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
      const service = await Service.create({ name: dept, nameKey: dept.toLowerCase(), department: dept, description: "Temporary staff isolation test" });
      owned.services.push(service._id); services.push(service);
    }
    const email = prefix + "@example.test", staffId = prefix.toUpperCase();
    const registration = { name: prefix + " Lecturer", email, password, confirmPassword: password, department, staffId };
    assert.equal((await call("/auth/staff/register", "POST", { ...registration, department: "Forged" })).status, 400);
    assert.equal((await call("/auth/staff/register", "POST", { ...registration, confirmPassword: "different" })).status, 400);
    const registered = await call("/auth/staff/register", "POST", { ...registration, role: "admin", approvalStatus: "approved", reviewedBy: admin._id });
    assert.equal(registered.status, 201); assert.equal(registered.token, undefined);
    const staff = await User.findOne({ email }).select("+password");
    owned.users.push(staff._id);
    assert.equal(staff.role, "staff"); assert.equal(staff.approvalStatus, "pending"); assert.equal(staff.reviewedBy, undefined);
    assert.ok(await bcrypt.compare(password, staff.password));
    assert.equal((await call("/auth/staff/register", "POST", registration)).status, 409);
    assert.equal((await call("/auth/staff/register", "POST", { ...registration, email: prefix + "-duplicate@example.test" })).status, 409);
    const pendingLogin = await call("/auth/login", "POST", { email, password, portal: "staff" });
    assert.equal(pendingLogin.status, 403); assert.match(pendingLogin.message, /awaiting administrator approval/);
    const oldToken = jwt.sign({ id: staff._id, role: "admin", approvalStatus: "approved", department: otherDepartment }, process.env.JWT_SECRET);
    assert.equal((await call("/staff/requests", "GET", undefined, oldToken)).status, 401);
    assert.equal((await call("/admin/staff-registrations", "GET", undefined, studentToken)).status, 403);
    const list = await call("/admin/staff-registrations?q=" + prefix + "&approvalStatus=pending&department=" + encodeURIComponent(department), "GET", undefined, adminToken);
    assert.equal(list.status, 200); assert.equal(list.total, 1); assert.equal(list.items[0].password, undefined);
    const getStaff = () => call("/admin/staff-registrations/" + staff._id, "GET", undefined, adminToken);
    const details = await getStaff();
    const review = { approvalStatus: "approved", expectedStatus: "pending", expectedUpdatedAt: details.user.updatedAt, department };
    const approved = await call("/admin/staff-registrations/" + staff._id, "PATCH", review, adminToken);
    assert.equal(approved.status, 200); assert.equal(approved.user.password, undefined);
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", review, adminToken)).status, 409);
    const history = await getStaff();
    assert.equal(history.user.approvalHistory.length, 1); assert.equal(history.user.reviewedBy, admin._id.toString());
    const staffLogin = await call("/auth/login", "POST", { email, password, portal: "staff" });
    assert.equal(staffLogin.status, 200); assert.equal(staffLogin.user.department, department);
    const staffToken = staffLogin.token;
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", review, staffToken)).status, 403);
    const requests = [];
    for (const service of services) {
      const response = await call("/requests", "POST", { serviceId: service._id, studentId: prefix, description: "Department request", priority: "Urgent" }, studentToken);
      assert.equal(response.status, 201); owned.requests.push(response.request._id); requests.push(response.request);
    }
    const legacyRequest = await Request.create({ student: student.user.id, studentId: prefix, service: services[0].name, description: "Legacy unlinked request" });
    owned.requests.push(legacyRequest._id);
    const ownId = requests[0]._id, otherId = requests[1]._id;
    const mine = await call("/staff/requests?department=" + encodeURIComponent(otherDepartment), "GET", undefined, staffToken);
    assert.equal(mine.status, 200); assert.equal(mine.total, 1); assert.equal(mine.items[0]._id, ownId);
    const dashboard = await call("/staff/dashboard", "GET", undefined, staffToken);
    assert.equal(dashboard.total, 1); assert.equal(dashboard.counts.Pending, 1);
    assert.equal((await call("/staff/requests?status=Pending&q=" + encodeURIComponent(services[1].name), "GET", undefined, staffToken)).total, 0);
    assert.equal((await call("/staff/requests/" + ownId, "GET", undefined, staffToken)).status, 200);
    for (const id of [otherId, legacyRequest._id]) {
      assert.equal((await call("/staff/requests/" + id, "GET", undefined, staffToken)).status, 404);
      assert.equal((await call("/staff/requests/" + id, "PATCH", { staffComment: "Unauthorized" }, staffToken)).status, 404);
    }
    for (const field of ["student", "service", "serviceRef", "department", "assignedStaff", "reviewedBy"])
      assert.equal((await call("/staff/requests/" + ownId, "PATCH", { [field]: otherId }, staffToken)).status, 400);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Completed", expectedStatus: "Pending" }, staffToken)).status, 409);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Processing", expectedStatus: "Pending", staffComment: "Reviewed by department" }, staffToken)).status, 200);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Approved", expectedStatus: "Pending" }, staffToken)).status, 409);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Completed", expectedStatus: "Processing" }, staffToken)).status, 200);
    assert.equal((await call("/staff/requests/" + ownId, "PATCH", { status: "Pending", expectedStatus: "Completed" }, staffToken)).status, 409);
    const tracked = await call("/requests/my", "GET", undefined, studentToken);
    assert.equal(tracked.requests.find((r) => r._id === ownId).status, "Completed");
    assert.equal((await Notification.countDocuments({ user: student.user.id })) > 0, true);
    assert.equal((await call("/admin/requests/" + otherId, "GET", undefined, adminToken)).status, 200);
    assert.equal((await call("/admin/requests/" + otherId, "PATCH", { status: "Processing", expectedStatus: "Pending" }, adminToken)).status, 200);
    const beforeReject = await getStaff();
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", {
      approvalStatus: "rejected", expectedStatus: "approved", expectedUpdatedAt: beforeReject.user.updatedAt, department,
    }, adminToken)).status, 200);
    assert.equal((await call("/auth/me", "GET", undefined, staffToken)).status, 401);
    assert.equal((await call("/staff/requests", "GET", undefined, staffToken)).status, 401);
    assert.match((await call("/auth/login", "POST", { email, password })).message, /rejected/);
    const rejected = await getStaff();
    assert.equal((await call("/admin/staff-registrations/" + staff._id, "PATCH", {
      approvalStatus: "approved", expectedStatus: "rejected", expectedUpdatedAt: rejected.user.updatedAt, department: otherDepartment,
    }, adminToken)).status, 200);
    const moved = await call("/staff/requests", "GET", undefined, staffToken);
    assert.equal(moved.total, 1); assert.equal(moved.items[0]._id, otherId);
    assert.equal((await call("/staff/requests/" + ownId, "GET", undefined, staffToken)).status, 404);
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
      approvalStatus: "approved", expectedStatus: "pending", expectedUpdatedAt: null, department,
    }, adminToken)).status, 200);
    console.log("Verified staff approval, audit history, student/Admin compatibility and department isolation; pre-existing records preserved.");
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
