import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import process from "node:process";
const backend = createRequire(new URL("../../backend/package.json", import.meta.url));
backend("dotenv").config({ path: fileURLToPath(new URL("../../backend/.env", import.meta.url)), quiet: true });
const mongoose = backend("mongoose"), bcrypt = backend("bcryptjs");
const jwt = backend("jsonwebtoken"), Request = backend("./models/Request"), Complaint = backend("./models/Complaint");
const User = backend("./models/user"), Service = backend("./models/service"), Slot = backend("./models/AppointmentSlot"), Appointment = backend("./models/Appointment"), Notification = backend("./models/Notification");
const prefix = "availability-ui-" + randomUUID(), password = randomUUID() + "Aa1!";
const users = [], email = role => prefix + role + "@example.test";
let service, staff;
const date = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
test.beforeAll(async () => {
  await backend("./config/db")();
  const hash = await bcrypt.hash(password, 12);
  for (const [role, key] of [["admin","admin"], ["staff","staff"], ["student","student"], ["student","second"]]) {
    const user = await User.create({ name: "Availability " + key, email: email(key), password: hash, role, ...(role === "staff" ? { staffId: prefix.slice(0, 50), approvalStatus: "approved" } : { studentId: prefix.slice(0, 35) + key }) });
    users.push(user._id); if (role === "staff") staff = user;
  }
  service = await Service.create({ name: prefix, nameKey: prefix, department: "Availability Test Services", description: "Temporary scheduling browser service" });
});
test.afterAll(async () => {
  try {
    const slots = staff ? await Slot.find({ staff: staff._id }).select("_id") : [];
    await Appointment.deleteMany({ slot: { $in: slots.map(slot => slot._id) } });
    await Slot.deleteMany({ _id: { $in: slots.map(slot => slot._id) } });
    await Notification.deleteMany({ user: { $in: users } });
    await Request.deleteMany({ student: { $in: users } });
    await Complaint.deleteMany({ student: { $in: users } });
    await User.deleteMany({ _id: { $in: users } });
    if (service) await Service.deleteOne({ _id: service._id });
  } finally { await mongoose.disconnect(); }
});
const sessions = new Map();
async function login(page, key, fresh = false) {
  const role = ["staff", "admin"].includes(key) ? key : "student";
  const destination = role === "staff" ? "/staff" : role === "admin" ? "/admin" : "/dashboard";
  if (!fresh && sessions.has(key)) {
    await page.goto("/login");
    await page.evaluate(session => { localStorage.setItem("token", session.token); localStorage.setItem("user", session.user); }, sessions.get(key));
    await page.goto(destination);
    await expect(page).toHaveURL(new RegExp(destination + "$"));
    return;
  }
  await page.goto(`/${role}/login`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.locator("#login-email").fill(email(key)); await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(role === "staff" ? /\/staff$/ : role === "admin" ? /\/admin$/ : /\/dashboard$/);
  sessions.set(key, await page.evaluate(() => ({ token: localStorage.getItem("token"), user: localStorage.getItem("user") })));
}
async function staffSlots(page) {
  await page.goto("/staff/appointments");
  await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
}
async function discover(page) {
  await page.goto("/appointments"); await page.getByLabel("Search availability", { exact: true }).fill(prefix);
  await page.getByLabel("University service", { exact: true }).selectOption(String(service._id));
}

test("staff publishes, students book, admin reviews, staff edits and cancels with notifications", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await login(page, "staff");
  await page.getByRole("link", { name: "Manage Time Slots", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/appointments$/);
  await page.getByRole("button", { name: "Create Availability", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Service", { exact: true }).selectOption(String(service._id));
  await page.getByLabel("Appointment Title", { exact: true }).fill(prefix + " consultation");
  await page.getByLabel("Appointment Date", { exact: true }).last().fill(date);
  await page.getByLabel("Start Time", { exact: true }).fill("09:00");
  await page.getByLabel("End Time", { exact: true }).fill("10:00");
  await page.getByLabel("Location (optional)", { exact: true }).fill("Student Services Building / Room 204");
  await page.getByRole("button", { name: "Publish availability", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".notice-success")).toHaveText("Availability published successfully.");
  const slot = await Slot.findOne({ staff: staff._id }); expect(slot.capacity).toBe(1); expect(slot.startsAt.toISOString().slice(11,16)).toBe("03:30");
  // Existing multi-capacity slots and hidden metadata remain compatible with the compact editor.
  await Slot.updateOne({ _id: slot._id }, { $set: { capacity: 2, description: "Discuss student service options.", durationMinutes: 20, instructions: "Bring student ID." } });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  await expect(page.locator(".appointment-card")).toContainText("Room 204");
  await expect(page.locator(".appointment-card")).toContainText("09:00");
  await page.getByLabel("Status", { exact: true }).selectOption("Draft");
  await expect(page.getByText("No availability matches this view", { exact: true })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("Published");
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  await page.screenshot({ path: "test-results/staff-availability-desktop.png", fullPage: true });
  await login(page, "student"); await discover(page);
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  await page.locator(".appointment-card").getByRole("button", { name: "Book Appointment", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Student Services Building / Room 204");
  await page.getByLabel("Reason", { exact: true }).fill("Please advise on my service request.");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Appointment booked successfully. Awaiting staff approval.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications", exact: true }).locator(".notification-count")).toHaveText("1");
  await expect(page.locator(".appointment-card")).toContainText("1 of 2 spaces available");
  await expect(page.getByLabel("My Appointments", { exact: true })).toContainText("Please advise on my service request.");
  // The server rejects a duplicate even while another space remains.
  await page.locator(".appointment-card").getByRole("button", { name: "Book Appointment", exact: true }).click();
  await page.getByLabel("Reason", { exact: true }).fill("Duplicate attempt");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already have a booking");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await login(page, "second"); await discover(page);
  await page.locator(".appointment-card").getByRole("button", { name: "Book Appointment", exact: true }).click();
  await page.getByLabel("Reason", { exact: true }).fill("Second student booking");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".appointment-card")).toHaveCount(0);
  expect(await Appointment.countDocuments({ slot: slot._id, status: "Pending" })).toBe(2);
  await login(page, "admin");
  await page.goto("/admin/appointment-slots");
  await expect(page).toHaveURL(/\/admin\/appointments\?view=availability$/);
  const navigation = page.getByRole("navigation", { name: "Admin navigation" });
  await expect(navigation.getByRole("link", { name: "Availability", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Appointments", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Publish availability", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Staff Availability", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search appointments" }).fill(prefix);
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  await expect(page.locator(".appointment-card")).toContainText("0 of 2 spaces available");
  await expect(page.locator(".appointment-card")).toContainText("2 booked");
  await page.getByLabel("Staff member", { exact: true }).selectOption(String(users[1]));
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  await page.getByLabel("Status", { exact: true }).selectOption("Draft");
  await expect(page.getByText("No availability matches this view", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".appointment-card").filter({ hasText: prefix })).toHaveCount(1);
  await page.getByRole("tab", { name: "Student Bookings", exact: true }).click();
  const booking = page.locator(".support-record").filter({ hasText: email("student") });
  await expect(booking).toHaveCount(1);
  for (const text of [prefix, "Availability staff", "Student Services Building / Room 204", "09:00", "10:00", "Pending"]) await expect(booking).toContainText(text);
  await booking.getByRole("button", { name: "View details", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Please advise on my service request.");
  await expect(page.getByRole("dialog")).toContainText("Bring student ID.");
  await page.getByRole("dialog").getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Status", { exact: true }).selectOption("Approved");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(booking.locator(".badge-approved").first()).toBeVisible();
  expect((await Appointment.findOne({ slot: slot._id, student: users[2] })).status).toBe("Approved");
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/admin-appointments-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "staff"); await staffSlots(page);
  await page.getByRole("button", { name: "View & manage", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(email("student"));
  await expect(page.getByRole("dialog")).toContainText(email("second"));
  await page.getByRole("button", { name: "Edit availability", exact: true }).click();
  await page.getByLabel("Location (optional)", { exact: true }).fill("Student Services Building / Office 208");
  await page.getByRole("button", { name: "Save availability", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".notice-success")).toContainText("Availability updated successfully.");
  const retained = await Slot.findById(slot._id);
  expect(retained.capacity).toBe(2); expect(retained.instructions).toBe("Bring student ID.");
  expect(retained.description).toBe("Discuss student service options."); expect(retained.durationMinutes).toBe(20);
  await login(page, "student"); await discover(page);
  await expect(page.getByLabel("My Appointments", { exact: true })).toContainText("Office 208");
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".appointment-card")).toContainText("1 of 2 spaces available");
  await expect(page.getByLabel("My Appointments", { exact: true })).toContainText("Cancelled");
  await login(page, "staff"); await staffSlots(page);
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/staff-availability-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "View & manage", exact: true }).click();
  await page.getByRole("button", { name: "Cancel availability", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await Slot.findById(slot._id)).status).toBe("Cancelled");
  expect(await Appointment.countDocuments({ slot: slot._id, status: "Cancelled" })).toBe(2);
  await login(page, "second"); await discover(page);
  await expect(page.locator(".appointment-card")).toHaveCount(0);
  await expect(page.getByLabel("My Appointments", { exact: true })).toContainText("Cancelled");
  await page.goto("/notifications");
  await expect(page.getByText("Your appointment was cancelled because the availability was cancelled.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("availability form saves a draft, publishes one space, and staff rejects then accepts bookings", async ({ page }) => {
  await login(page, "staff"); await staffSlots(page);
  await page.getByRole("button", { name: "Create Availability", exact: true }).click();
  const dialog = page.getByRole("dialog"), form = dialog.locator("form");
  await expect(form.locator("input, select, textarea")).toHaveCount(8);
  await expect(form.locator("[required]")).toHaveCount(6);
  await expect(form.locator("textarea")).toHaveCount(1);
  await dialog.getByLabel("Service", { exact: true }).selectOption(String(service._id));
  await dialog.getByLabel("Appointment Title", { exact: true }).fill(prefix + " compact");
  await dialog.getByLabel("Appointment Date", { exact: true }).fill("2020-01-01");
  expect(await dialog.getByLabel("Appointment Date", { exact: true }).evaluate(input => input.validity.rangeUnderflow)).toBe(true);
  await dialog.getByLabel("Appointment Date", { exact: true }).fill(date);
  await dialog.getByLabel("Start Time", { exact: true }).fill("11:00");
  await dialog.getByLabel("End Time", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "Publish availability", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("End time must be later than start time.");
  await dialog.getByLabel("End Time", { exact: true }).fill("12:00");
  for (const width of [1280, 820, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await dialog.evaluate(element => element.getBoundingClientRect().height <= window.innerHeight)).toBe(true);
    for (const name of ["Service", "Appointment Title", "Appointment Date", "Start Time", "End Time"]) {
      await dialog.getByLabel(name, { exact: true }).scrollIntoViewIfNeeded();
      const box = await dialog.getByLabel(name, { exact: true }).boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    await page.screenshot({ path: `test-results/compact-availability-${width}.png`, fullPage: true });
  }
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".notice-success")).toHaveText("Availability saved as draft.");
  let slot = await Slot.findOne({ staff: staff._id, title: prefix + " compact" });
  expect(slot.capacity).toBe(1); expect(slot.status).toBe("Draft");
  expect(slot.category).toBe(service.department); expect(slot.description).toBe(""); expect(slot.location).toBe("");
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "student"); await discover(page);
  await expect(page.locator(".appointment-card")).toHaveCount(0);
  await login(page, "staff"); await staffSlots(page);
  await page.getByLabel("Status", { exact: true }).selectOption("Draft");
  await page.getByRole("button", { name: "View & manage", exact: true }).click();
  await dialog.getByRole("button", { name: "Edit availability", exact: true }).click();
  await dialog.getByRole("button", { name: "Publish availability", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  slot = await Slot.findById(slot._id); expect(slot.status).toBe("Published");
  const book = async key => {
    await login(page, key); await discover(page);
    await expect(page.locator(".appointment-card")).toHaveCount(1);
    await page.locator(".appointment-card").getByRole("button", { name: "Book Appointment", exact: true }).click();
    await dialog.getByLabel("Reason", { exact: true }).fill(prefix + " compact reason");
    await dialog.getByRole("button", { name: "Confirm booking", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(page.locator(".appointment-card")).toHaveCount(0);
  };
  const review = async status => {
    await login(page, "staff"); await page.goto("/staff/bookings");
    await page.getByLabel("Search bookings", { exact: false }).fill(prefix + " compact reason");
    await expect(page.locator("tbody tr")).toHaveCount(status === "Rejected" ? 1 : 2);
    await page.getByRole("button", { name: "Review", exact: true }).first().click();
    await dialog.getByLabel("Update status", { exact: true }).selectOption(status);
    if (status === "Rejected") await dialog.getByLabel("Rejection reason", { exact: true }).fill("Please choose another appointment time.");
    await dialog.getByRole("button", { name: "Review changes", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirm changes", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await Appointment.countDocuments({ slot: slot._id, status })).toBe(1);
  };
  await book("student"); await review("Rejected");
  await book("second"); await review("Approved");
  expect(await Appointment.countDocuments({ slot: slot._id, status: { $in: ["Pending", "Approved"] } })).toBe(1);
});

test("real student notices open owned booking, request and complaint details and preserve read state", async ({ page }) => {
  test.setTimeout(240000);
  const call = async (path, userIndex, method = "GET", data) => {
    const response = await page.request.fetch(`/api${path}`, { method, headers: { Authorization: "Bearer " + jwt.sign({ id: String(users[userIndex]) }, process.env.JWT_SECRET) }, ...(data && { data }) });
    const body = await response.json();
    expect(response.status(), JSON.stringify(body)).toBe(method === "POST" ? 201 : 200);
    return body;
  };
  await login(page, "student"); await discover(page);
  await page.getByLabel("Search availability", { exact: true }).fill(prefix + " direct");
  const start = new Date(date + "T16:00:00+05:30");
  const created = await call("/staff/appointment-slots", 1, "POST", { service: String(service._id), title: prefix + " direct", startsAt: start.toISOString(), endsAt: new Date(+start + 3600000).toISOString(), location: "Registry Room 204", status: "Published" });
  // A different user's successful publication is discovered on focus, without a page reload.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".appointment-card")).toHaveCount(1);
  await page.locator(".appointment-card").getByRole("button", { name: "Book Appointment", exact: true }).click();
  await page.getByLabel("Reason", { exact: true }).fill("Direct notification booking");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const booking = await Appointment.findOne({ slot: created.slot._id });
  await call("/notifications", 1);
  expect(await Notification.countDocuments({ user: users[1], entityId: booking._id, title: "New appointment booking" })).toBe(1);
  const openNotice = async (title, entityId, pathname, text) => {
    const notice = await Notification.findOne({ user: users[2], entityId, title }).sort({ createdAt: -1 });
    expect(notice).toBeTruthy();
    const unread = await Notification.countDocuments({ user: users[2], isRead: false });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await expect(bell.locator(".notification-count")).toHaveText(String(unread));
    await bell.click();
    expect(await Notification.countDocuments({ user: users[2], isRead: false })).toBe(unread);
    await page.getByRole("region", { name: "Notifications dropdown" }).locator(`a[href="${pathname}?notification=${notice._id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${pathname}\\?notification=${notice._id}$`));
    await expect(page.getByRole("dialog")).toContainText(String(entityId));
    await expect(page.getByRole("dialog")).toContainText(text);
    await expect(bell.locator(".notification-count")).toHaveText(String(unread - 1));
    expect(await Notification.countDocuments({ user: users[2], isRead: false })).toBe(unread - 1);
    expect((await Notification.findById(notice._id)).readAt).toBeTruthy();
    await page.reload(); await expect(page.getByRole("dialog")).toContainText(text);
    await page.getByRole("button", { name: "Back to list", exact: true }).click();
    return notice;
  };
  await call(`/staff/bookings/${booking._id}`, 1, "PATCH", { status: "Approved", expectedStatus: "Pending", expectedUpdatedAt: booking.updatedAt.toISOString() });
  await openNotice("Appointment approved", booking._id, "/appointments", "Registry Room 204");
  const approved = await Appointment.findById(booking._id);
  await call(`/staff/bookings/${booking._id}`, 1, "PATCH", { status: "Rejected", expectedStatus: "Approved", expectedUpdatedAt: approved.updatedAt.toISOString(), rejectionReason: "Please choose a Registry appointment instead." });
  await openNotice("Appointment rejected", booking._id, "/appointments", "Please choose a Registry appointment instead.");
  const request = await call("/requests", 2, "POST", { serviceId: String(service._id), studentId: prefix.slice(0, 35) + "student", description: "Direct request notification" });
  const assigned = await call(`/admin/requests/${request.request._id}`, 0, "PATCH", { assignedStaff: String(users[1]), expectedUpdatedAt: request.request.updatedAt });
  await call(`/staff/requests/${request.request._id}`, 1, "PATCH", { status: "Processing", expectedStatus: "Pending", expectedUpdatedAt: assigned.request.updatedAt, staffComment: "Your documents are being verified." });
  const requestNotice = await openNotice("Request processing", request.request._id, "/my-requests", "Your documents are being verified.");
  const complaint = await call("/complaints", 2, "POST", { subject: prefix + " concern", description: "Direct complaint notification" });
  const record = await Complaint.findById(complaint.complaint._id);
  const assignment = await call(`/admin/complaints/${record._id}/assignment`, 0, "PATCH", { assignedStaff: String(users[1]), expectedUpdatedAt: record.updatedAt.toISOString() });
  await call(`/staff/complaints/${record._id}`, 1, "PATCH", { status: "Resolved", expectedStatus: "In Progress", expectedUpdatedAt: assignment.item.updatedAt, response: "We have corrected your university record." });
  await openNotice("Complaint response received", record._id, "/complaints", "We have corrected your university record.");
  await login(page, "student", true); await page.goto(`/complaints?notification=${(await Notification.findOne({ user: users[2], entityId: record._id, title: "Complaint response received" }))._id}`);
  await expect(page.getByRole("dialog")).toContainText("We have corrected your university record.");
  await Request.deleteOne({ _id: request.request._id });
  await page.goto(`/my-requests?notification=${requestNotice._id}`);
  await expect(page.getByText("This record is no longer available.", { exact: false })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
