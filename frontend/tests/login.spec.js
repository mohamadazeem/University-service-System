import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const requireBackend = createRequire(new URL("../../backend/package.json", import.meta.url));
requireBackend("dotenv").config({ path: fileURLToPath(new URL("../../backend/.env", import.meta.url)), quiet: true });
const mongoose = requireBackend("mongoose");
const User = requireBackend("./models/user");
const Request = requireBackend("./models/Request");
const Service = requireBackend("./models/service");
const bcrypt = requireBackend("bcryptjs");
const prefix = "portal-e2e-" + randomUUID();
const email = prefix + "@example.test";
const adminEmail = prefix + "-admin@example.test";
const password = randomUUID() + "Aa1!";
let adminId;
let serviceId;

test.beforeAll(async () => {
  await requireBackend("./config/db")();
  const admin = await User.create({ name: "Portal Test Administrator", email: adminEmail, password: await bcrypt.hash(password, 12), role: "admin" });
  adminId = admin._id;
  const service = await Service.create({ name: prefix, nameKey: prefix, description: "Temporary portal browser test service", department: "Browser testing" });
  serviceId = service._id;
});
test.afterAll(async () => {
  try {
    const student = await User.findOne({ email });
    if (student) {
      // Only records belonging to this run's uniquely named test student.
      for (const request of await Request.find({ student: student._id }).select("_id"))
        await Request.deleteOne({ _id: request._id });
      await User.deleteOne({ _id: student._id });
    }
    if (adminId) await User.deleteOne({ _id: adminId });
    if (serviceId) await Service.deleteOne({ _id: serviceId });
  } finally { await mongoose.disconnect(); }
});

const signIn = async (page, accountEmail, button = "Sign In") => {
  await page.getByLabel(/email/i).fill(accountEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: button, exact: true }).click();
};

test("portal selection, real student/admin sessions, registration, requests and access boundaries", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Welcome to\s*University Services/);
  await expect(page.locator("form")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.locator(".auth-brand")).toBeFocused();
  await expect(page.locator(".auth-brand")).toHaveCSS("outline-style", "solid");
  const desktopCards = await page.locator(".portal-option").all();
  expect((await desktopCards[0].boundingBox()).y).toEqual((await desktopCards[1].boundingBox()).y);
  await page.getByRole("link", { name: "Admin Login" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  await page.getByRole("link", { name: "Back to portal selection" }).click();
  await page.getByRole("link", { name: "Student Login" }).click();
  await expect(page).toHaveURL(/\/student\/login$/);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#login-email:invalid")).toHaveCount(1);
  await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Portal Test Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel("Student ID").fill(prefix);
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(page.getByRole("status")).toContainText("Registration successful");
  await page.getByRole("status").getByRole("link", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/student\/login$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome, Portal Test Student" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome, Portal Test Student" })).toBeVisible();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/request-service");
  await page.getByRole("combobox", { name: /^Service/ }).selectOption({ label: prefix });
  await page.getByLabel("Description").fill("Temporary portal browser test request");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status")).toContainText("submitted successfully");
  await page.getByRole("link", { name: /Track your request/ }).click();
  await expect(page.getByRole("cell", { name: "Temporary portal browser test request", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await signIn(page, email, "Admin Sign In");
  await expect(page.getByRole("alert")).toContainText("does not have administrator access");
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await signIn(page, adminEmail, "Admin Sign In");
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
    await expect(page.getByRole("link", { name: "Admin Login" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const cards = await page.locator(".portal-option").all();
  expect((await cards[1].boundingBox()).y).toBeGreaterThan((await cards[0].boundingBox()).y);
  await page.screenshot({ path: "test-results/portal-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Student Login" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/student-login-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Back to portal selection" }).click();
  await page.getByRole("link", { name: "Admin Login" }).click();
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-login-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("network and server errors leave the login form usable", async ({ page }) => {
  await page.goto("/student/login");
  await page.route("**/api/auth/login", (route) => route.abort("failed"));
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("Cannot reach the server");
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
