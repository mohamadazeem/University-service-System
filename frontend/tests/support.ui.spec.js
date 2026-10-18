// UI contract tests use explicit fixtures; these do not verify database persistence.
import { test, expect } from "@playwright/test";
const student = { id: "222222222222222222222222", name: "UI Student", role: "student", email: "ui@example.test" };
const admin = { ...student, id: "111111111111111111111111", name: "UI Admin", role: "admin" };
const slot = { status: "Published", capacity: 1, remaining: 1, endsAt: "2099-01-20T09:30:00.000Z", title: "Student support", _id: "333333333333333333333333", startsAt: "2099-01-20T09:00:00.000Z", staff: { _id: "444444444444444444444444", name: "Support staff" } };
async function session(page, user) {
  await page.addInitScript(() => localStorage.setItem("token", "ui-fixture"));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user } }));
  await page.route("**/api/notifications/unread-count", route => route.fulfill({ json: { unread: 0 } }));
  await page.route("**/api/admin/complaints/overview", route => route.fulfill({ json: { total: 0, unassigned: 0, inProgress: 0, resolved: 0, highPriority: 0 } }));
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to University Services");
    await expect(page.locator(".login-welcome .login-intro")).toHaveText("Access your account to manage your requests, appointments and more.");
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
  await page.route("**/api/appointments/availability**", route => route.fulfill({ json: { items: [slot], total: 1, pages: 1 } }));
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
  await expect(page.getByText("No bookings yet.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
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
test("admin centralizes appointments, reviews complaints and navigates mobile sidebar", async ({ page }) => {
  await session(page, admin);
  await page.route("**/api/admin/appointments?**", route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  let status = "Pending";
  const complaint = () => ({ _id: "complaint", subject: "A concern", description: "Review details", status, student, priority: "Medium", createdAt: new Date().toISOString(), updatedAt: "2026-10-17T00:00:00.000Z" });
  await page.route("**/api/admin/complaints**", async route => {
    if (route.request().url().includes("/overview")) return route.fulfill({ json: { total: 1, unassigned: 1, inProgress: 0, resolved: status === "Resolved" ? 1 : 0, highPriority: 0 } });
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      expect(body.status).toBe("Resolved"); expect(body.response).toBe("We have resolved this concern."); status = body.status;
      return route.fulfill({ json: { message: "Complaint response saved successfully.", item: complaint() } });
    }
    if (route.request().url().includes("/complaints/complaint")) return route.fulfill({ json: { item: complaint(), allowedStatuses: ["In Progress", "Resolved", "Rejected"], priorities: ["Medium", "High", "Urgent"] } });
    await route.fulfill({ json: { items: [complaint()], total: 1, pages: 1, statuses: ["Pending", "In Progress", "Resolved"], departments: [], priorities: ["Medium", "High", "Urgent"] } });
  });
  await page.goto("/admin/appointments");
  await expect(page.getByRole("button", { name: "Publish availability" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Availability", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Complaints Management", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Update status", exact: true }).selectOption("Resolved");
  await page.getByLabel("Response").fill("We have resolved this concern.");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm changes", exact: true }).click();
  await expect(page.locator(".support-record .badge-resolved")).toHaveText("Resolved");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-complaints-mobile.png", fullPage: true });
});

test("admin rejects bookings, filters statuses and views historical records with missing slots", async ({ page }) => {
  await session(page, admin);
  let status = "Pending";
  const booking = () => ({ _id: "booking", status, student, slot: null, staff: null, date: slot.startsAt, reason: "Historical booking", updatedAt: "2026-10-17T00:00:00.000Z", createdAt: "2026-10-17T00:00:00.000Z" });
  await page.route("**/api/admin/appointments?**", route => {
    const filter = new URL(route.request().url()).searchParams.get("status");
    const items = !filter || filter === status ? [booking()] : [];
    return route.fulfill({ json: { items, total: items.length, pages: items.length } });
  });
  await page.route("**/api/admin/appointments/booking", route => {
    expect(route.request().postDataJSON()).toEqual({ status: "Rejected", rejectionReason: "Please choose another appointment time.", expectedStatus: "Pending", expectedUpdatedAt: "2026-10-17T00:00:00.000Z" });
    status = "Rejected";
    return route.fulfill({ json: { message: "Booking updated successfully." } });
  });
  await page.goto("/admin/appointment-slots");
  await expect(page).toHaveURL(/\/admin\/appointments$/);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Not specified");
  await dialog.getByLabel("Status", { exact: true }).selectOption("Rejected");
  await dialog.getByLabel("Rejection reason", { exact: true }).fill("Please choose another appointment time.");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Filter by status").selectOption("Approved");
  await expect(page.getByText("No appointments match this view.")).toBeVisible();
  await page.getByLabel("Filter by status").selectOption("Rejected");
  await expect(page.locator(".support-record")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(dialog).toContainText("Historical booking");
  await expect(dialog).toContainText("Rejected");
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
  await page.route("**/api/appointments/availability**", route => route.fulfill({ json: { items: [slot], total: 1, pages: 1 } }));
  await page.goto("/appointments");
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await expect(page.getByLabel("Reason")).toHaveCSS("background-color", "rgb(21, 34, 53)");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.route("**/api/services", route => route.fulfill({ json: { services: [] } }));
  await page.route("**/api/requests/my", route => route.fulfill({ json: { requests: [] } }));
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-stat").first()).toHaveCSS("background-color", "rgb(21, 34, 53)");
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
  await expect(page.getByRole("button", { name: "Publish availability" })).toHaveCount(0);
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

test("public footer has working links and stays outside authentication pages and workspaces", async ({ page }) => {
  await page.route("**/api/services", route => route.fulfill({ json: { services: [] } }));
  const footer = page.locator(".site-footer");
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/services", "/student/login", "/staff/login", "/admin/login", "/register", "/staff/register", "/missing-page"]) {
      await page.goto(path);
      if (["/login", "/student/login", "/staff/login", "/admin/login", "/register", "/staff/register"].includes(path)) {
        await expect(footer).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        continue;
      }
      await expect(footer).toHaveCount(1);
      await expect(footer.locator("a")).toHaveCount(2);
      await expect(footer.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
      await expect(footer.getByRole("link", { name: "Service Catalogue", exact: true })).toHaveAttribute("href", "/services");
      await expect(footer).toContainText("Your central platform for university services, requests, and support.");
      await expect(footer).toContainText("© 2026 University Services. All rights reserved.");
      await expect(footer.getByRole("link", { name: /portal|login/i })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const layout = await page.evaluate(() => {
        const footer = document.querySelector(".site-footer");
        const main = document.querySelector("main");
        return { bottom: footer.getBoundingClientRect().bottom + scrollY, height: document.documentElement.scrollHeight, top: footer.getBoundingClientRect().top, contentBottom: main.getBoundingClientRect().bottom, position: getComputedStyle(footer).position };
      });
      expect(Math.abs(layout.bottom - layout.height)).toBeLessThanOrEqual(2);
      expect(layout.top).toBeGreaterThanOrEqual(layout.contentBottom - 1);
      expect(layout.position).not.toBe("fixed");
      if (path === "/missing-page") expect(layout.height).toBe(900);
    }
    await page.goto("/"); await footer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/footer-${width}.png`, fullPage: true });
  }
  await footer.getByRole("link", { name: "Service Catalogue", exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  await footer.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await footer.getByRole("link", { name: "Home", exact: true }).focus();
  await expect(footer.getByRole("link", { name: "Home", exact: true })).toBeFocused();
  await session(page, admin);
  await page.route("**/api/admin/appointments?**", route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  await page.goto("/admin/appointments");
  await expect(page.locator(".admin-footer")).toHaveCount(1); await expect(footer).toHaveCount(0);
  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: { ...student, role: "staff", approvalStatus: "approved" } } }));
  await page.route("**/api/staff/bookings?**", route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  await page.goto("/staff/bookings");
  await expect(page.locator(".staff-footer")).toHaveCount(1); await expect(footer).toHaveCount(0);
});

test("student registration matches the split design, fits mobile and validates confirmation before sending", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/auth/register", async route => { writes++; await route.fulfill({ status: 400, json: { message: "Email already registered" } }); });
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your student account", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/student/login");
  for (const width of [1536, 820, 390]) {
    await page.setViewportSize({ width, height: 1024 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/registration-${width}.png`, fullPage: true });
  }
  await page.getByLabel("Full name", { exact: true }).fill("Test Student");
  await page.getByLabel("Email address", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Different123!");
  await page.getByRole("button", { name: "Show confirm password" }).click();
  await expect(page.getByLabel("Confirm password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Create student account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match"); expect(writes).toBe(0);
  await page.getByLabel("Confirm password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Create student account", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Email already registered"); expect(writes).toBe(1);
  await expect(page.getByRole("button", { name: "Create student account", exact: true })).toBeEnabled();
});

test("authentication fits desktop viewports and stays reachable on short or zoom-sized screens", async ({ page }) => {
  test.setTimeout(60000);
  for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    for (const path of ["/login", "/student/login", "/staff/login", "/admin/login", "/register", "/staff/register"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, sections: [...document.querySelectorAll(".public-content, .registration-story, .login-content, .portal-login-card, .login-panel-header, .site-footer")].map(e => ({ name: e.className, height: e.getBoundingClientRect().height })) }));
      expect(metrics.scrollWidth, path + " horizontal overflow").toBeLessThanOrEqual(width);
      expect(metrics.scrollHeight, path + " vertical overflow " + JSON.stringify(metrics.sections)).toBeLessThanOrEqual(height + 1);
      const controls = page.locator("input:not([type=radio]), button, a, h1, form label, form small");
      for (const control of await controls.all()) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box.y, path).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, path).toBeLessThanOrEqual(height + 1);
        expect(box.x, path).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, path).toBeLessThanOrEqual(width + 1);
      }
      if (["/login", "/register", "/staff/register"].includes(path)) await page.screenshot({ path: `test-results/auth-fit-${path.replaceAll("/", "-")}-${width}.png`, fullPage: true });
    }
  }
  // 683×384 is the CSS viewport of a 1366×768 display at 200% browser zoom.
  for (const [width, height] of [[1366, 500], [683, 384], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const path of ["/login", "/register", "/staff/register"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const control of await page.locator("input:not([type=radio]), button[type=submit], .registration-submit, .site-footer a").all()) {
        await control.scrollIntoViewIfNeeded(); await expect(control).toBeInViewport();
      }
    }
  }
});

test("staff registration is responsive and checks confirmation before requesting approval", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/auth/staff/register", async route => { writes++; expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(["email", "name", "password", "staffId"]); await route.fulfill({ status: 201, json: { message: "Registration submitted successfully. Please wait for administrator approval before signing in." } }); });
  await page.goto("/staff/register");
  await expect(page.getByRole("heading", { name: "Create your staff account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/staff/login");
  for (const width of [1536, 820, 390]) {
    await page.setViewportSize({ width, height: 1024 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/staff-registration-${width}.png`, fullPage: true });
  }
  await page.getByLabel("Full name", { exact: true }).fill("Test Lecturer");
  await page.getByLabel("Email address", { exact: true }).fill("staff@example.test");
  await page.getByLabel("Staff ID / Employee Number", { exact: true }).fill("S12345");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Different123!");
  await page.getByRole("button", { name: "Create staff account" }).click();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match"); expect(writes).toBe(0);
  await page.getByLabel("Confirm password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Create staff account" }).click();
  await expect(page.getByRole("status")).toContainText("wait for administrator approval"); expect(writes).toBe(1);
});

test("student dashboard uses live API contracts, books slots, opens notifications and fits all screens", async ({ page }) => {
  test.setTimeout(60000);
  await session(page, student);
  const request = { _id: "555555555555555555555555", service: "Academic records", status: "Pending", createdAt: "2026-10-17T09:00:00Z" };
  let read = false, booked = false;
  await page.route("**/api/services", route => route.fulfill({ json: { services: [{ _id: "service", name: "Academic records" }] } }));
  await page.route("**/api/requests/my", route => route.fulfill({ json: { requests: [request, { ...request, _id: "completed", status: "Completed" }] } }));
  await page.route("**/api/appointments/availability**", route => route.fulfill({ json: { items: booked ? [] : [{ ...slot, serviceName: "Student advice", location: "Student Centre" }], total: booked ? 0 : 1, pages: 1 } }));
  await page.route("**/api/notifications?**", route => route.fulfill({ json: { items: [{ _id: request._id, title: "Request updated", message: "Your academic records request is being reviewed.", type: "request", entityId: request._id, isRead: read, createdAt: request.createdAt }], unread: read ? 0 : 1, total: 1, pages: 1 } }));
  await page.route("**/api/notifications/*/read", route => { read = true; return route.fulfill({ json: { message: "Read" } }); });
  await page.route("**/api/notifications/*/related", route => route.fulfill({ json: { type: "request", item: request } }));
  await page.route(/\/api\/appointments$/, route => { expect(route.request().postDataJSON()).toEqual({ slot: slot._id, reason: "Academic advice" }); booked = true; return route.fulfill({ json: { message: "Appointment booked successfully." } }); });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome, UI Student" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Available services: 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "My requests: 2", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pending requests: 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Completed requests: 1", exact: true })).toBeVisible();
  await expect(page.locator('.site-header nav a[href="/dashboard"]')).toHaveAttribute("aria-current", "page");
  for (const [width, height] of [[1366,768],[1920,1080],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await expect(page.locator(".dashboard-stat").first()).toHaveCSS("background-color", theme === "dark" ? "rgb(21, 34, 53)" : "rgb(255, 255, 255)");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width >= 1366) expect(await page.locator('.dashboard-columns').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
      await page.screenshot({ path: `test-results/dashboard-${width}-${theme}.png`, fullPage: true });
    }
  }
  await page.getByRole("button", { name: "Book Appointment", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Student Centre");
  await page.getByLabel("Reason", { exact: true }).fill("Academic advice");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.locator(".appointment-discovery .notice-success")).toHaveText("Appointment booked successfully.");
  expect(booked).toBe(true);
  await expect(page.getByText("No published appointments with available spaces match this view.")).toBeVisible();
  await page.locator('.dashboard-notifications').getByRole("link", { name: "Request updated" }).click();
  await expect(page).toHaveURL(/\/my-requests\?notification=/);
  expect(read).toBe(true);
  await expect(page.getByRole("dialog", { name: "Service request details" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.locator('.dashboard-notifications .notification-state')).toHaveText("Read");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
