import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { appointmentFields } from "../src/utils/appointmentTime.js";

const requireBackend = createRequire(new URL("../../backend/package.json", import.meta.url));
requireBackend("dotenv").config({ path: fileURLToPath(new URL("../../backend/.env", import.meta.url)), quiet: true });
const mongoose = requireBackend("mongoose");
const User = requireBackend("./models/user");
const Request = requireBackend("./models/Request");
const Service = requireBackend("./models/service");
const Appointment = requireBackend("./models/Appointment");
const Slot = requireBackend("./models/AppointmentSlot");
const Complaint = requireBackend("./models/Complaint");
const Notification = requireBackend("./models/Notification");
const bcrypt = requireBackend("bcryptjs");
const prefix = "portal-e2e-" + randomUUID();
const email = prefix + "@example.test";
const adminEmail = prefix + "-admin@example.test";
const password = randomUUID() + "Aa1!";
let adminId;
let serviceId;
let staffId;
const ownedSlots = [];

test.beforeAll(async () => {
  await requireBackend("./config/db")();
  const admin = await User.create({ name: "Portal Test Administrator", email: adminEmail, password: await bcrypt.hash(password, 12), role: "admin" });
  adminId = admin._id;
  const staff = await User.create({ name: prefix + " Staff", email: prefix + "-staff@example.test", password: await bcrypt.hash(password, 12), role: "staff", approvalStatus: "approved", department: "Browser testing" });
  staffId = staff._id;
  const service = await Service.create({ name: prefix, nameKey: prefix, description: "Temporary portal browser test service", department: "Browser testing" });
  serviceId = service._id;
});
test.afterAll(async () => {
  try {
    const student = await User.findOne({ email });
    if (student) {
      for (const record of await Appointment.find({ student: student._id }).select("_id")) await Appointment.deleteOne({ _id: record._id });
      for (const record of await Complaint.find({ student: student._id }).select("_id")) await Complaint.deleteOne({ _id: record._id });
      for (const record of await Notification.find({ user: student._id }).select("_id")) await Notification.deleteOne({ _id: record._id });
      // Only records belonging to this run's uniquely named test student.
      for (const request of await Request.find({ student: student._id }).select("_id"))
        await Request.deleteOne({ _id: request._id });
      await User.deleteOne({ _id: student._id });
    }
    await Notification.deleteMany({ user: { $in: [adminId, staffId].filter(Boolean) } });
    if (adminId) await User.deleteOne({ _id: adminId });
    for (const id of ownedSlots) await Slot.deleteOne({ _id: id });
    if (staffId) await User.deleteOne({ _id: staffId });
    if (serviceId) await Service.deleteOne({ _id: serviceId });
  } finally { await mongoose.disconnect(); }
});

const signIn = async (page, accountEmail) => {
  // Wait for the login route's inputs, rather than the outgoing registration form.
  await page.locator("#login-email").fill(accountEmail);
  await page.locator("#login-password").fill(password);
  await expect(page.locator("#login-email")).toHaveValue(accountEmail);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
};

test("unified role selection, real student/admin sessions, registration, requests and access boundaries", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Sign in to\s*University Services/);
  await expect(page.locator("form")).toHaveCount(1);
  await expect(page.locator(".portal-option")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Student", exact: true })).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.locator(".login-story .registration-brand")).toBeFocused();
  await expect(page.locator(".login-story .registration-brand")).toHaveCSS("outline-style", "solid");
  await page.getByRole("radio", { name: "Admin", exact: true }).check();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to University Services" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Create an account|Register for approval/ })).toHaveCount(0);
  await page.getByRole("radio", { name: "Student", exact: true }).check();
  await expect(page).toHaveURL(/\/student\/login$/);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#login-email:invalid")).toHaveCount(1);
  await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await page.getByLabel("University email").fill(email);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Portal Test Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByLabel("Student ID").fill(prefix);
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(page.getByRole("status")).toContainText("Registration successful");
  await page.getByRole("status").getByRole("link", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/student\/login$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Student Dashboard" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Student Dashboard" })).toBeVisible();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/request-service");
  await page.getByRole("combobox", { name: /^Service/ }).selectOption({ label: prefix });
  await page.getByLabel("Description").fill("Temporary portal browser test request");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status")).toContainText("submitted successfully");
  await page.getByRole("link", { name: /Track your request/ }).click();
  await expect(page.getByRole("cell", { name: "Temporary portal browser test request", exact: true })).toBeVisible();
  await page.locator(".staff-nav-bottom").getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/student\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("does not have administrator access");
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await signIn(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
  for (const path of ["/dashboard", "/request-service", "/my-requests"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin$/);
  }
  await page.goto("/admin/services");
  await expect(page.getByRole("heading", { name: "University services", exact: true })).toBeVisible();
  await page.locator(".profile-menu summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/student/login");
  await signIn(page, adminEmail);
  await expect(page.getByRole("alert")).toContainText("does not have student access");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.evaluate(() => localStorage.setItem("token", "expired-test-token"));
  await page.reload();
  await expect(page).toHaveURL(/\/student\/login$/);
  await expect(page.getByRole("status")).toContainText("session may have expired");
  await page.goto("/login");
  await page.screenshot({ path: "test-results/portal-desktop.png", fullPage: true });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("radio", { name: "Admin", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: "test-results/portal-mobile.png", fullPage: true });
  await page.getByRole("radio", { name: "Student", exact: true }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/student-login-mobile.png", fullPage: true });
  await page.getByRole("radio", { name: "Admin", exact: true }).check();
  await expect(page.getByRole("radio", { name: "Admin", exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-login-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("network and server errors leave the login form usable", async ({ page }) => {
  await page.goto("/student/login");
  await page.route("**/api/auth/login", (route) => route.abort("failed"));
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("The application server is unavailable");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();
  await page.unroute("**/api/auth/login");
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "The service is temporarily unavailable. Please try again." }) }));
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await page.unroute("**/api/auth/login");
  await page.route("**/api/auth/login", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Invalid email or password" }) });
  });
  await signIn(page, email);
  await expect(page.getByRole("button", { name: "Signing in" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
});


test("real support workflows persist across student and administrator sessions", async ({ page }) => {
  // This test also runs independently if Playwright restarts a failed worker.
  if (!(await User.exists({ email }))) await User.create({ name: "Support Test Student", email, studentId: prefix, password: await bcrypt.hash(password, 12), role: "student" });
  const switchPortal = async (role, accountEmail) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/${role}/login`);
    await signIn(page, accountEmail);
    await expect(page).toHaveURL(role === "admin" ? /\/admin$/ : role === "staff" ? /\/staff$/ : /\/dashboard$/);
  };
  await page.goto("/login");
  await switchPortal("staff", prefix + "-staff@example.test");
  await page.goto("/staff/appointments");
  await page.getByRole("button", { name: "Create Availability", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Service", { exact: true }).selectOption(String(serviceId));
  await page.getByLabel("Appointment Title", { exact: true }).fill(prefix);
  await page.getByLabel("Appointment Date", { exact: true }).last().fill(appointmentFields(new Date(Date.now() + 86400000)).date);
  await page.getByLabel("Start Time", { exact: true }).fill("09:00");
  await page.getByLabel("End Time", { exact: true }).fill("10:00");
  await page.getByLabel("Location (optional)", { exact: true }).fill("Student Services / Office 1");
  await page.getByRole("button", { name: "Publish availability" }).click();
  await expect(page.locator(".notice-success")).toHaveText("Availability published successfully.");
  const storedSlot = await Slot.findOne({ staff: staffId });
  expect(storedSlot).toBeTruthy();
  ownedSlots.push(storedSlot._id);
  await switchPortal("student", email);
  await page.goto("/appointments");
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.getByLabel("Available time").selectOption(storedSlot._id.toString());
  await page.getByLabel("Reason").fill(prefix + " appointment");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".notice-success")).toHaveText("Saved successfully.");
  await page.reload();
  await expect(page.getByText(prefix + " appointment", { exact: true })).toBeVisible();
  const student = await User.findOne({ email });
  expect((await Appointment.findOne({ student: student._id })).status).toBe("Pending");
  await page.goto("/complaints");
  await page.getByRole("button", { name: "Submit complaint" }).click();
  await page.getByLabel("Subject").fill(prefix + " concern");
  await page.getByLabel("Description").fill("Please review this temporary test concern.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".notice-success")).toHaveText("Saved successfully.");
  await switchPortal("admin", adminEmail);
  await page.goto("/admin/appointments");
  const appointmentRecord = page.locator(".support-record").filter({ hasText: prefix + " appointment" });
  await appointmentRecord.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox").selectOption("Approved");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".notice-success")).toHaveText("Saved successfully.");
  await page.goto("/admin/complaints");
  const complaintRecord = page.locator(".support-record").filter({ hasText: prefix + " concern" });
  await complaintRecord.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByLabel("Update status", { exact: true }).selectOption("Resolved");
  await page.getByLabel("Response").fill("Temporary browser concern resolved.");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm changes", exact: true }).click();
  await expect(page.locator(".notice-success")).toHaveText("Complaint response saved successfully.");
  expect((await Complaint.findOne({ student: student._id })).response).toBe("Temporary browser concern resolved.");
  await switchPortal("student", email);
  await page.goto("/appointments");
  await expect(page.locator(".support-record .badge")).toHaveText("Approved");
  await page.goto("/complaints");
  await expect(page.getByText("Temporary browser concern resolved.", { exact: true })).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByText(/^Complaint status: Resolved\./)).toBeVisible();
  await page.locator(".notification-item").filter({ hasText: "Complaint status: Resolved." }).getByRole("button", { name: "Mark as read" }).click();
  await expect(page.locator(".notification-item").filter({ hasText: "Complaint status: Resolved." }).getByRole("button")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".notification-item").filter({ hasText: "Complaint status: Resolved." }).getByRole("button")).toHaveCount(0);
  expect(await Notification.countDocuments({ user: student._id, isRead: true })).toBeGreaterThan(0);
});
