// Explicit opt-in command. Uses unique new records and removes only those IDs.
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Service = require("../models/service");
const Request = require("../models/Request");
const Appointment = require("../models/Appointment");
const Slot = require("../models/AppointmentSlot");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const app = require("../app");
test(
  "MongoDB: authentication, CRUD, metrics, filtering, status rules and revocation",
  { timeout: 120000 },
  async () => {
    const owned = { users: [], services: [], requests: [], appointments: [], slots: [], complaints: [] };
    let server;
    const prefix = "Integration-" + Date.now();
    const password = "Test-only-password-2026";
    try {
      await require("../config/db")();
      await Promise.all([User.init(), Service.init(), Request.init(), Appointment.init(), Slot.init(), Complaint.init(), Notification.init()]);
      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      const call = async (path, method = "GET", data, token) => {
        const response = await fetch(origin + "/api" + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: "Bearer " + token }),
          },
          ...(data !== undefined && { body: JSON.stringify(data) }),
        });
        return { status: response.status, ...(await response.json()) };
      };
      const admin = await User.create({
        name: prefix + " Admin",
        email: prefix.toLowerCase() + "-admin@example.test",
        password: await bcrypt.hash(password, 12),
        role: "admin",
      });
      owned.users.push(admin._id);
      const login = await call("/auth/login", "POST", {
        email: admin.email,
        password,
        portal: "admin",
      });
      assert.equal(login.status, 200);
      const adminToken = login.token;
      const baseline = await call(
        "/admin/dashboard",
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(baseline.status, 200);
      const register = await call("/auth/register", "POST", {
        name: prefix + " Student",
        email: prefix.toLowerCase() + "-student@example.test",
        studentId: prefix,
        password,
        role: "admin",
      });
      assert.equal(register.status, 201);
      assert.equal(register.user.role, "student");
      owned.users.push(register.user.id);
      const studentLogin = await call("/auth/login", "POST", {
        email: register.user.email,
        password,
        portal: "student",
      });
      const studentToken = studentLogin.token;
      assert.equal(studentLogin.status, 200);
      for (const [email, portal] of [[admin.email, "student"], [register.user.email, "admin"]]) {
        const denied = await call("/auth/login", "POST", { email, password, portal });
        assert.equal(denied.status, 403);
        assert.equal(denied.token, undefined);
      }
      assert.equal((await call("/requests/my", "GET", undefined, adminToken)).status, 403);
      assert.equal((await call("/admin/dashboard")).status, 401);
      assert.equal(
        (await call("/admin/dashboard", "GET", undefined, studentToken)).status,
        403,
      );
      const forgedRole = jwt.sign(
        { id: register.user.id, role: "admin" },
        process.env.JWT_SECRET,
      );
      assert.equal(
        (await call("/admin/users", "GET", undefined, forgedRole)).status,
        403,
      );
      const staff = await call(
        "/admin/users",
        "POST",
        {
          name: prefix + " Staff",
          email: prefix.toLowerCase() + "-staff@example.test",
          password,
          role: "staff",
        },
        adminToken,
      );
      assert.equal(staff.status, 201);
      owned.users.push(staff.user._id);
      assert.equal(
        (
          await call(
            "/admin/services",
            "POST",
            { name: "Forbidden" },
            studentToken,
          )
        ).status,
        403,
      );
      const created = await call(
        "/admin/services",
        "POST",
        {
          name: prefix,
          department: "Integration testing",
          description: "Temporary service; this record is removed by the test.",
        },
        adminToken,
      );
      assert.equal(created.status, 201);
      owned.services.push(created.service._id);
      const serviceId = created.service._id;
      const staffDetails = await call("/admin/staff-registrations/" + staff.user._id, "GET", undefined, adminToken);
      assert.equal((await call("/admin/staff-registrations/" + staff.user._id, "PATCH", {
        approvalStatus: "approved", expectedStatus: "pending",
        expectedUpdatedAt: staffDetails.user.updatedAt,
      }, adminToken)).status, 200);
      const staffLogin = await call("/auth/login", "POST", { email: staff.user.email, password });
      assert.equal(staffLogin.status, 200);
      const duplicate = await call(
        "/admin/services",
        "POST",
        {
          name: prefix.toLowerCase(),
          department: "Test",
          description: "Duplicate",
        },
        adminToken,
      );
      assert.equal(duplicate.status, 409);
      assert.equal(
        (
          await call(
            "/admin/services?sort=invalid",
            "GET",
            undefined,
            adminToken,
          )
        ).status,
        400,
      );
      const updated = await call(
        "/admin/services/" + serviceId,
        "PATCH",
        { processingTime: "2 working days", name: prefix + " Updated" },
        adminToken,
      );
      assert.equal(updated.status, 200);
      assert.equal(
        (await Service.findById(serviceId)).processingTime,
        "2 working days",
      );
      const read = await call(
        "/admin/services/" + serviceId,
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(read.service.name, prefix + " Updated");
      const list = await call(
        "/admin/services?q=" + prefix + "&limit=1&sort=name&order=asc",
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(list.total, 1);
      assert.equal(list.items.length, 1);
      const submitted = await call(
        "/requests",
        "POST",
        {
          serviceId,
          studentId: prefix,
          description: "Integration request",
          priority: "Urgent",
        },
        studentToken,
      );
      assert.equal(submitted.status, 201);
      owned.requests.push(submitted.request._id);
      const requestId = submitted.request._id;
      assert.equal(
        (
          await call(
            "/requests",
            "POST",
            {
              serviceId,
              studentId: prefix,
              description: "Invalid",
              status: "Approved",
            },
            studentToken,
          )
        ).status,
        400,
      );
      const requests = await call(
        "/admin/requests?q=" +
          prefix +
          "&status=Pending&priority=Urgent&limit=1",
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(requests.total, 1);
      const details = await call(
        "/admin/requests/" + requestId,
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(details.request.student.email, register.user.email);
      assert.equal(details.request.student.password, undefined);
      const changed = await call(
        "/admin/requests/" + requestId + "/status",
        "PATCH",
        {
          status: "Processing",
          expectedStatus: "Pending",
          assignedStaff: staff.user._id,
          staffComment: "Processing your request",
        },
        adminToken,
      );
      assert.equal(changed.status, 200);
      assert.equal((await Request.findById(requestId)).status, "Processing");
      assert.equal(
        (
          await call(
            "/admin/requests/" + requestId + "/status",
            "PATCH",
            { status: "Approved", expectedStatus: "Pending" },
            adminToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/admin/requests/" + requestId + "/status",
            "PATCH",
            { status: "Completed", expectedStatus: "Processing" },
            adminToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            "/admin/requests/" + requestId + "/status",
            "PATCH",
            { status: "Pending", expectedStatus: "Completed" },
            adminToken,
          )
        ).status,
        409,
      );
      const mine = await call("/requests/my", "GET", undefined, studentToken);
      assert.equal(mine.requests.length, 1);
      assert.equal(mine.requests[0].staffComment, "Processing your request");
      const dashboard = await call(
        "/admin/dashboard",
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(dashboard.students, baseline.students + 1);
      assert.equal(dashboard.staff, baseline.staff + 1);
      assert.equal(dashboard.totalRequests, baseline.totalRequests + 1);
      assert.equal(
        dashboard.statusCounts.Completed,
        baseline.statusCounts.Completed + 1,
      );
      assert.equal(dashboard.trends.length, 6);
      // Persistent support workflows, concurrency, inbox delivery and ownership.
      const startsAt = new Date(Date.now() + 86400000).toISOString();
      const published = await call("/admin/appointment-slots", "POST", { staff: staff.user._id, startsAt }, adminToken);
      assert.equal(published.status, 201);
      owned.slots.push(published.slot._id);
      const slotId = published.slot._id;
      const available = await call("/appointments/availability", "GET", undefined, studentToken);
      assert.ok(available.items.some(row => row._id === slotId));
      const bookings = await Promise.all([1, 2].map(() => call("/appointments", "POST", { slot: slotId, reason: prefix + " appointment" }, studentToken)));
      assert.deepEqual(bookings.map(row => row.status).sort(), [201, 409]);
      const bookingId = bookings.find(row => row.status === 201).appointment._id;
      owned.appointments.push(bookingId);
      assert.equal((await Appointment.findById(bookingId)).student.toString(), register.user.id);
      assert.equal((await call("/appointments/availability", "GET", undefined, studentToken)).items.some(row => row._id === slotId), false);
      assert.equal((await call(`/admin/appointments/${bookingId}`, "PATCH", { expectedStatus: "Pending", status: "Approved" }, studentToken)).status, 403);
      assert.equal((await call(`/admin/appointments/${bookingId}`, "PATCH", { expectedStatus: "Pending", status: "Approved" }, adminToken)).status, 200);
      assert.equal((await call(`/admin/appointments/${bookingId}`, "PATCH", { expectedStatus: "Pending", status: "Rejected" }, adminToken)).status, 409);
      assert.equal((await call(`/admin/appointments/${bookingId}`, "PATCH", { expectedStatus: "Approved", status: "Completed" }, adminToken)).status, 409);
      assert.equal((await call(`/admin/appointments/${bookingId}`, "PATCH", { expectedStatus: "Approved", status: "Rejected" }, adminToken)).status, 200);
      assert.equal((await Appointment.findById(bookingId)).reservedSlot, undefined);
      assert.ok((await call("/appointments/availability", "GET", undefined, studentToken)).items.some(row => row._id === slotId));
      assert.equal((await call(`/admin/appointment-slots/${slotId}`, "DELETE", undefined, adminToken)).status, 200);
      assert.equal((await call("/appointments", "POST", { slot: slotId, reason: "Closed" }, studentToken)).status, 409);
      const submittedComplaint = await call("/complaints", "POST", { subject: prefix, description: "Integration concern" }, studentToken);
      assert.equal(submittedComplaint.status, 201);
      const complaintId = submittedComplaint.complaint._id;
      owned.complaints.push(complaintId);
      for (const [expectedStatus, status] of [["Pending", "In Review"], ["In Review", "Resolved"]])
        assert.equal((await call(`/admin/complaints/${complaintId}`, "PATCH", { expectedStatus, status, response: `Concern ${status}` }, adminToken)).status, 200);
      assert.equal((await Complaint.findById(complaintId)).response, "Concern Resolved");
      assert.equal((await call("/complaints", "GET", undefined, studentToken)).items[0]._id, complaintId);
      const inbox = await call("/notifications?limit=100", "GET", undefined, studentToken);
      assert.equal(inbox.status, 200);
      assert.equal(inbox.items.length, 9);
      assert.equal(inbox.unread, 9);
      assert.ok(inbox.items.every(row => row.user === undefined && row.eventKey === undefined));
      assert.equal(await Notification.countDocuments({ _id: { $in: inbox.items.map(row => row._id) }, user: register.user.id }), inbox.items.length);
      const notificationId = inbox.items[0]._id;
      assert.equal((await call(`/notifications/${notificationId}/read`, "PATCH", undefined, adminToken)).status, 404);
      assert.equal((await call(`/notifications/${notificationId}/read`, "PATCH", undefined, studentToken)).status, 200);
      const inboxAgain = await call("/notifications?limit=100", "GET", undefined, studentToken);
      assert.equal(inboxAgain.items.length, 9);
      assert.equal(inboxAgain.unread, 8);
      assert.equal((await Notification.findById(notificationId)).isRead, true);
      assert.equal((await call("/appointments", "GET", undefined, studentToken)).items[0].status, "Rejected");
      assert.equal((await call("/admin/complaints?status=Resolved", "GET", undefined, adminToken)).items.some(row => row._id === complaintId), true);
      const users = await call(
        "/admin/users?q=" + prefix + "&sort=name&order=asc&limit=1",
        "GET",
        undefined,
        adminToken,
      );
      assert.equal(users.total, 3);
      assert.equal(users.pages, 3);
      assert.ok(users.items.every((user) => !("password" in user)));
      assert.equal(
        (
          await call(
            "/admin/users/" + staff.user._id + "/role",
            "PATCH",
            { role: "student" },
            adminToken,
          )
        ).status,
        200,
      );
      const current = await call(
        "/auth/me",
        "GET",
        undefined,
        staffLogin.token,
      );
      assert.equal(current.user.role, "student");
      assert.equal(
        (
          await call(
            "/admin/users/" + admin._id + "/role",
            "PATCH",
            { role: "student" },
            adminToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/admin/users/" + admin._id,
            "DELETE",
            undefined,
            adminToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/admin/services/" + serviceId,
            "DELETE",
            undefined,
            adminToken,
          )
        ).status,
        200,
      );
      assert.equal((await Service.findById(serviceId)).active, false);
      assert.ok(await Request.findById(requestId));
      assert.equal(
        (
          await call(
            "/requests",
            "POST",
            { serviceId, studentId: prefix, description: "No longer active" },
            studentToken,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await call(
            "/admin/services/" + serviceId,
            "PATCH",
            { active: true },
            adminToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            "/admin/users/" + register.user.id,
            "DELETE",
            undefined,
            adminToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (await call("/auth/me", "GET", undefined, studentToken)).status,
        401,
      );
      assert.ok(await Request.findById(requestId));
      assert.equal(
        (
          await call(
            "/admin/users/" + register.user.id,
            "PATCH",
            { active: true, phone: "0123456789" },
            adminToken,
          )
        ).status,
        200,
      );
      assert.equal((await User.findById(register.user.id)).phone, "0123456789");
      assert.equal(
        (
          await call("/auth/login", "POST", {
            email: register.user.email,
            password,
          })
        ).status,
        200,
      );
      console.log(
        "Verified real MongoDB CRUD and preserved all pre-existing records.",
      );
    } finally {
      // Never reset the database or delete by broad filters.
      for (const id of owned.requests) await Request.deleteOne({ _id: id });
      for (const id of owned.appointments) await Appointment.deleteOne({ _id: id });
      for (const id of owned.slots) await Slot.deleteOne({ _id: id });
      for (const id of owned.complaints) await Complaint.deleteOne({ _id: id });
      for (const id of owned.users) await Notification.deleteMany({ user: id });
      for (const id of owned.services) await Service.deleteOne({ _id: id });
      for (const id of owned.users) await User.deleteOne({ _id: id });
      if (server) await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
    }
  },
);
