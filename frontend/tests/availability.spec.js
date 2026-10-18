import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const backend = createRequire(new URL("../../backend/package.json", import.meta.url));
backend("dotenv").config({ path: fileURLToPath(new URL("../../backend/.env", import.meta.url)), quiet: true });
const mongoose = backend("mongoose"), bcrypt = backend("bcryptjs");
const User = backend("./models/user"), Service = backend("./models/service"), Slot = backend("./models/AppointmentSlot"), Appointment = backend("./models/Appointment"), Notification = backend("./models/Notification");
const prefix = "availability-ui-" + randomUUID(), password = randomUUID() + "Aa1!";
const users = [], email = role => prefix + role + "@example.test";
let service, staff;
const date = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
test.beforeAll(async () => {
  await backend("./config/db")();
  const hash = await bcrypt.hash(password, 12);
  for (const [role, key] of [["admin","admin"], ["staff","staff"], ["student","student"], ["student","second"]]) {
    const user = await User.create({ name: "Availability " + key, email: email(key), password: hash, role, ...(role === "staff" ? { staffId: prefix.slice(0, 50), approvalStatus: "approved" } : { studentId: prefix + key }) });
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
    await User.deleteMany({ _id: { $in: users } });
    if (service) await Service.deleteOne({ _id: service._id });
  } finally { await mongoose.disconnect(); }
});
async function login(page, key) {
  const role = ["staff", "admin"].includes(key) ? key : "student";
  await page.goto(`/${role}/login`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.locator("#login-email").fill(email(key)); await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(role === "staff" ? /\/staff$/ : role === "admin" ? /\/admin$/ : /\/dashboard$/);
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
  await page.getByLabel("Service category", { exact: true }).selectOption("Availability Test Services");
  await page.getByLabel("University service", { exact: true }).selectOption(String(service._id));
  await page.getByLabel("Appointment title", { exact: true }).fill(prefix + " consultation");
  await page.getByLabel("Description / purpose", { exact: true }).fill("Discuss student service options.");
  await page.getByLabel("Appointment date", { exact: true }).last().fill(date);
  await page.getByLabel("Start time", { exact: true }).fill("09:00");
  await page.getByLabel("End time", { exact: true }).fill("10:00");
  await page.getByLabel("Building / department", { exact: true }).fill("Student Services Building");
  await page.getByLabel("Room / office", { exact: true }).fill("Room 204");
  await page.getByLabel("Maximum students", { exact: true }).fill("2");
  await page.getByLabel("Duration (minutes, optional)", { exact: true }).fill("20");
  await page.getByLabel("Additional instructions", { exact: true }).fill("Bring student ID.");
  await page.getByRole("button", { name: "Publish availability", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".notice-success")).toHaveText("Availability published successfully.");
  const slot = await Slot.findOne({ staff: staff._id }); expect(slot.capacity).toBe(2); expect(slot.startsAt.toISOString().slice(11,16)).toBe("03:30");
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
  await expect(page).toHaveURL(/\/admin\/appointments$/);
  const navigation = page.getByRole("navigation", { name: "Admin navigation" });
  await expect(navigation.getByRole("link", { name: "Availability", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Appointments", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Publish availability", exact: true })).toHaveCount(0);
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
  await page.getByLabel("Room / office", { exact: true }).fill("Office 208");
  await page.getByLabel("Additional instructions", { exact: true }).fill("Updated instructions: bring student ID to Office 208.");
  await page.getByRole("button", { name: "Save availability", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".notice-success")).toContainText("Availability updated successfully.");
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
