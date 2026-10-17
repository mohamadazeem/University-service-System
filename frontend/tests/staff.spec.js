import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const backend = createRequire(new URL("../../backend/package.json", import.meta.url));
backend("dotenv").config({ path: fileURLToPath(new URL("../../backend/.env", import.meta.url)), quiet: true });
const mongoose = backend("mongoose");
const User = backend("./models/user");
const Service = backend("./models/service");
const Request = backend("./models/Request");
const Notification = backend("./models/Notification");
const bcrypt = backend("bcryptjs");
const prefix = "staff-browser-" + randomUUID();
const email = prefix + "@example.test";
const adminEmail = prefix + "-admin@example.test";
const password = randomUUID() + "Aa1!";
const department = prefix + " Registry";
const otherDepartment = prefix + " Library";
const owned = { users: [], services: [], requests: [] };

test.beforeAll(async () => {
  await backend("./config/db")();
  const hash = await bcrypt.hash(password, 12);
  const admin = await User.create({ name: "Staff Review Administrator", email: adminEmail, password: hash, role: "admin" });
  owned.users.push(admin._id);
  const student = await User.create({ name: "Department Test Student", email: prefix + "-student@example.test", password: hash, role: "student", studentId: prefix });
  owned.users.push(student._id);
  for (const dept of [department, otherDepartment]) {
    const service = await Service.create({ name: dept, nameKey: dept.toLowerCase(), department: dept, description: "Temporary staff browser service" });
    owned.services.push(service._id);
    const request = await Request.create({ student: student._id, studentId: prefix, service: service.name, serviceRef: service._id, description: "Please review this department request", priority: "Urgent" });
    owned.requests.push(request._id);
  }
});
test.afterAll(async () => {
  try {
    const staff = await User.findOne({ email }).select("_id");
    if (staff) owned.users.push(staff._id);
    for (const id of owned.requests) await Request.deleteOne({ _id: id });
    for (const id of owned.services) await Service.deleteOne({ _id: id });
    for (const id of owned.users) {
      await Notification.deleteMany({ user: id });
      await User.deleteOne({ _id: id });
    }
  } finally { await mongoose.disconnect(); }
});
const signIn = async (page, address, admin = false) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: admin ? "Admin" : "Staff / Lecturer", exact: true }).check();
  await page.locator("#login-email").fill(address);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
};

test("four-field staff registration → approval → all-department processing → rejection", async ({ page, browser }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByRole("radio", { name: "Staff / Lecturer", exact: true })).toBeChecked();
  await page.getByRole("link", { name: "Register for approval" }).click();
  await expect(page.getByRole("heading", { name: "Staff Registration", exact: true })).toBeVisible();
  expect(await page.locator("form input").evaluateAll((inputs) => inputs.map((input) => input.name))).toEqual(["name", "email", "staffId", "password"]);
  await expect(page.locator("form select")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/staff-registration-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "test-results/staff-registration-desktop.png", fullPage: true });
  await page.getByLabel("Full Name").fill("Department Test Lecturer");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/Staff ID/).fill(prefix);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByRole("status")).toHaveText("Registration submitted successfully. Please wait for administrator approval before signing in.");
  await signIn(page, email);
  await expect(page.getByRole("alert")).toHaveText("Your account is awaiting administrator approval.");
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  const adminContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const adminPage = await adminContext.newPage();
  adminPage.on("pageerror", (error) => errors.push(error.message));
  try {
    await signIn(adminPage, adminEmail, true);
    await expect(adminPage).toHaveURL(/\/admin$/);
    await adminPage.getByRole("link", { name: "Staff approvals", exact: true }).click();
    await adminPage.getByLabel("Search staff").fill(prefix);
    const staffRow = adminPage.getByRole("row").filter({ hasText: email });
    await expect(staffRow).toHaveCount(1);
    await staffRow.getByRole("button", { name: "Review" }).click();
    await expect(adminPage.getByRole("dialog")).toContainText("Department Test Lecturer");
    await expect(adminPage.getByRole("dialog").getByRole("combobox")).toHaveCount(0);
    await adminPage.getByRole("button", { name: "Approve", exact: true }).click();
    await adminPage.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(adminPage.getByText("Staff registration approved", { exact: true })).toBeVisible();
    await adminPage.getByLabel("Approval status", { exact: true }).selectOption("approved");
    await expect(staffRow).toHaveCount(1);
    await adminPage.screenshot({ path: "test-results/staff-approvals-desktop.png", fullPage: true });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByRole("heading", { name: "Welcome, Department Test Lecturer" })).toBeVisible();
    await page.getByLabel("Search requests").fill(prefix);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.locator("tbody")).toContainText(department);
    await expect(page.locator("tbody")).toContainText(otherDepartment);
    await page.getByLabel("Department", { exact: true }).selectOption(otherDepartment);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody")).toContainText(otherDepartment);
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Please review this department request");
    await expect(page.getByLabel("Assigned staff")).toHaveCount(0);
    await page.getByLabel("Request status").selectOption("Processing");
    await page.getByLabel("Staff comments").fill("Reviewed across departments");
    await page.getByRole("button", { name: "Review changes" }).click();
    await page.getByRole("button", { name: "Confirm changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("tbody")).toContainText("Processing");
    await page.reload();
    await page.getByLabel("Search requests").fill(prefix);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByLabel("Department", { exact: true }).selectOption(otherDepartment);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody")).toContainText("Processing");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/staff-dashboard-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Frontend direct-route guard preserves the staff workspace.
    await page.goto("/admin/staff-approvals");
    await expect(page).toHaveURL(/\/staff$/);
    await staffRow.getByRole("button", { name: "Review" }).click();
    await adminPage.getByRole("button", { name: "Reject", exact: true }).click();
    await adminPage.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(adminPage.getByText("Staff registration rejected", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/staff\/login$/);
    await signIn(page, email);
    await expect(page.getByRole("alert")).toContainText("rejected");
    expect(errors).toEqual([]);
  } finally { await adminContext.close(); }
});
