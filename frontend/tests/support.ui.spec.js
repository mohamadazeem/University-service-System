// UI contract tests use explicit fixtures; these do not verify database persistence.
import { test, expect } from "@playwright/test";
const student = { id: "222222222222222222222222", name: "UI Student", role: "student", email: "ui@example.test" };
const admin = { ...student, id: "111111111111111111111111", name: "UI Admin", role: "admin" };
const slot = { _id: "333333333333333333333333", startsAt: "2099-01-20T09:00:00.000Z", staff: { _id: "444444444444444444444444", name: "Support staff" } };
async function session(page, user) {
  await page.addInitScript(() => localStorage.setItem("token", "ui-fixture"));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user } }));
}
test("original homepage and unified login fit desktop, tablet and mobile", async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connecting Students to University Services.");
    await expect(page.getByRole("img", { name: "University campus building" })).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator(".home-hero").getByRole("link", { name: "Sign In", exact: true })).toHaveAttribute("href", "/login");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    await page.locator(".home-hero").getByRole("link", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to University Services");
    await expect(page.locator(".login-welcome p")).toHaveText("Access university services, manage requests, and stay updated in one place.");
    await expect(page.getByRole("link", { name: "Services", exact: true })).toHaveAttribute("href", "/services");
    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.getByRole("radiogroup", { name: "Sign in role" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(3);
    await expect(page.locator(".portal-option")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/login-${width}.png`, fullPage: true });
  }
  await page.getByRole("radio", { name: "Staff / Lecturer", exact: true }).check();
  await expect(page).toHaveURL(/staff\/login$/);
  await expect(page.getByRole("link", { name: "Register for approval" })).toHaveAttribute("href", "/staff/register");
});
test("role switcher supports keyboard selection, correct login payloads and registration links", async ({ page }) => {
  const submissions = [];
  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON();
    submissions.push(body);
    await route.fulfill({ status: 403, json: { message: body.portal === "staff" ? "Your account is awaiting administrator approval." : "This account does not have administrator access. Choose the correct portal." } });
  });
  await page.goto("/login");
  await page.getByLabel("University email").fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  const studentRole = page.getByRole("radio", { name: "Student", exact: true });
  await studentRole.focus();
  await page.keyboard.press("ArrowRight");
  const staffRole = page.getByRole("radio", { name: "Staff / Lecturer", exact: true });
  await expect(staffRole).toBeChecked();
  await expect(staffRole).toBeFocused();
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("University email")).toHaveValue("member@example.test");
  await expect(page.getByRole("link", { name: "Register for approval" })).toHaveAttribute("href", "/staff/register");
  await expect(page.getByText("Staff accounts require administrator approval before signing in.")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Your account is awaiting administrator approval.");
  await staffRole.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Admin", exact: true })).toBeChecked();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByRole("link", { name: /Create an account|Register for approval/ })).toHaveCount(0);
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("does not have administrator access");
  expect(submissions.map((body) => body.portal)).toEqual(["staff", "admin"]);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await page.getByRole("radio", { name: "Student", exact: true }).check();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: /forgot password/i })).toHaveCount(0);
});

test("student books, submits a complaint and reads notifications", async ({ page }) => {
  await session(page, student);
  let appointments = [], complaints = [], read = false;
  await page.route("**/api/appointments/availability", route => route.fulfill({ json: { items: [slot] } }));
  await page.route(/\/api\/appointments(?:\?|$)/, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ slot: slot._id, reason: "Academic advice" });
      appointments = [{ _id: "appointment", date: slot.startsAt, reason: body.reason, status: "Pending", createdAt: new Date().toISOString() }];
    }
    await route.fulfill({ json: { items: appointments, pages: 1, total: appointments.length } });
  });
  await page.route(/\/api\/complaints(?:\?|$)/, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      complaints = [{ ...body, _id: "complaint", status: "Pending", createdAt: new Date().toISOString() }];
    }
    await route.fulfill({ json: { items: complaints, pages: 1, total: complaints.length } });
  });
  await page.route("**/api/notifications**", async route => {
    if (route.request().method() === "PATCH") read = true;
    await route.fulfill({ json: { items: [{ _id: "notification", message: "Your complaint has been received for review.", isRead: read, createdAt: new Date().toISOString() }], pages: 1, total: 1, unread: read ? 0 : 1 } });
  });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/appointments");
  await expect(page.getByText("No appointments yet.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.getByLabel("Available time").selectOption(slot._id);
  await page.getByLabel("Reason").fill("Academic advice");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Academic advice")).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Complaints", exact: true }).click();
  await page.getByRole("button", { name: "Submit complaint" }).click();
  await page.getByLabel("Subject").fill("Support concern");
  await page.getByLabel("Description").fill("Please review my concern.");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Support concern" })).toBeVisible();
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 unread" })).toBeVisible();
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByRole("heading", { name: "0 unread" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("admin publishes availability, reviews complaints and navigates mobile sidebar", async ({ page }) => {
  await session(page, admin);
  await page.route("**/api/admin/staff", route => route.fulfill({ json: { staff: [slot.staff] } }));
  await page.route("**/api/appointments/availability", route => route.fulfill({ json: { items: [slot] } }));
  await page.route("**/api/admin/appointment-slots", async route => {
    expect(route.request().postDataJSON().staff).toBe(slot.staff._id);
    await route.fulfill({ status: 201, json: { slot } });
  });
  await page.route("**/api/admin/appointments?**", route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  let status = "Pending";
  await page.route("**/api/admin/complaints**", async route => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ status: "Resolved", expectedStatus: "Pending", response: "We have resolved this concern." });
      status = body.status;
    }
    await route.fulfill({ json: { items: [{ _id: "complaint", subject: "A concern", description: "Review details", status, student, createdAt: new Date().toISOString() }], total: 1, pages: 1 } });
  });
  await page.goto("/admin/appointments");
  await page.getByRole("button", { name: "Publish availability" }).click();
  await page.getByLabel("Staff member").selectOption(slot.staff._id);
  await page.getByLabel("Start date and time").fill("2099-01-20T09:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".notice-success")).toHaveText("Saved successfully.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Complaints", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Status", exact: true }).selectOption("Resolved");
  await page.getByLabel("Response").fill("We have resolved this concern.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".support-record .badge")).toHaveText("Resolved");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-complaints-mobile.png", fullPage: true });
});

test("empty staff setup explains disabled publishing and refreshes after staff is added", async ({ page }) => {
  await session(page, admin);
  let staff = [];
  await page.route("**/api/admin/staff", route => route.fulfill({ json: { staff } }));
  await page.route("**/api/appointments/availability", route => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/admin/appointments?**", route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  await page.goto("/admin/appointments");
  await expect(page.getByRole("heading", { name: "Add a staff member to enable bookings" })).toBeVisible();
  await page.getByRole("button", { name: "Publish availability" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("No active staff accounts are available.", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Manage staff accounts" })).toHaveAttribute("href", "/admin/users");
  await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  staff = [slot.staff];
  await dialog.getByRole("button", { name: "Refresh staff list" }).click();
  await dialog.getByLabel("Staff member").selectOption(slot.staff._id);
  await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
});

test("theme follows the system, persists a choice and covers public pages", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/api/services", route => route.fulfill({ json: { services: [] } }));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(13, 22, 36)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  expect(await page.evaluate(() => localStorage.getItem("university-theme"))).toBe("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/login", "/student/login", "/admin/login", "/register", "/services"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/");
    await page.screenshot({ path: `test-results/home-dark-${width}.png`, fullPage: true });
  }
  await page.goto("/login");
  await page.getByRole("radio", { name: "Staff / Lecturer", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("saved dark theme covers student and administrator panels and dialogs", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("university-theme", "dark"));
  await session(page, student);
  await page.route("**/api/appointments?**", route => route.fulfill({ json: { items: [], pages: 0, total: 0 } }));
  await page.route("**/api/appointments/availability", route => route.fulfill({ json: { items: [slot] } }));
  await page.goto("/appointments");
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await expect(page.getByLabel("Reason")).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.route("**/api/services", route => route.fulfill({ json: { services: [] } }));
  await page.route("**/api/requests/my", route => route.fulfill({ json: { requests: [] } }));
  await page.goto("/dashboard");
  await expect(page.locator(".metric-card").first()).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await page.screenshot({ path: "test-results/student-dashboard-dark.png", fullPage: true });
  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: admin } }));
  await page.route("**/api/admin/staff", route => route.fulfill({ json: { staff: [slot.staff] } }));
  await page.route("**/api/admin/appointments?**", route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  await page.route("**/api/admin/dashboard", route => route.fulfill({ json: {
    students: 0, staff: 0, services: 0, totalRequests: 0,
    statusCounts: { Pending: 0, Processing: 0, Approved: 0, Rejected: 0, Completed: 0 },
    trends: Array.from({ length: 6 }, (_, i) => ({ month: `2026-0${i + 1}`, count: 0 })), recentRequests: [],
  } }));
  await page.goto("/admin");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".donut > div")).toHaveCSS("background-color", "rgb(21, 34, 53)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/admin-dashboard-dark-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/appointments");
  await expect(page.locator(".admin-shell")).toHaveCSS("background-color", "rgb(13, 22, 36)");
  await expect(page.locator(".admin-topbar")).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await page.getByRole("button", { name: "Publish availability" }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme toggle remains usable with blocked storage and reduced motion", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Storage unavailable"); };
    Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
  });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".theme-toggle")).toHaveCSS("transition-duration", "0s");
  expect(errors).toEqual([]);
});
