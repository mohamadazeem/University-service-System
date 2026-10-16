// UI contract tests use explicit fixtures; these do not verify database persistence.
import { test, expect } from "@playwright/test";
const student = { id: "222222222222222222222222", name: "UI Student", role: "student", email: "ui@example.test" };
const admin = { ...student, id: "111111111111111111111111", name: "UI Admin", role: "admin" };
const slot = { _id: "333333333333333333333333", startsAt: "2099-01-20T09:00:00.000Z", staff: { _id: "444444444444444444444444", name: "Support staff" } };
async function session(page, user) {
  await page.addInitScript(() => localStorage.setItem("token", "ui-fixture"));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user } }));
}
test("homepage and portal navigation fit desktop, tablet and mobile", async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Less paperwork");
    await expect(page.getByRole("link", { name: "Explore services" })).toHaveAttribute("href", "/services");
    await expect(page.getByRole("img", { name: "University campus" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Student portal", exact: true }).click();
  await expect(page).toHaveURL(/student\/login$/);
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
