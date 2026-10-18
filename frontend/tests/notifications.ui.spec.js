// UI contract fixtures complement notifications.integration.js's real persistence/security tests.
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", error => console.error(error.stack));
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
});

async function fixtures(page, role, amount) {
  const user = { id: "111111111111111111111111", name: "Notification Tester", role, approvalStatus: "approved", email: "notification@example.test" };
  let items = Array.from({ length: amount }, (_, i) => ({ _id: String(i).padStart(24, "0"), title: `${role} update ${i + 1}`, message: `${role} message ${i + 1}`, type: i % 2 ? "appointment" : "request", entityType: i % 2 ? "appointment" : "request", createdAt: new Date(Date.UTC(2026, 9, 18, 12, 0, 0) - i * 60000).toISOString(), isRead: false }));
  await page.addInitScript(() => localStorage.setItem("token", "notification-ui-token"));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method();
    if (!path.startsWith("/api/")) return route.continue();
    let json = { items: [], requests: [], services: [], departments: [], staff: [], statuses: [], total: 0, page: 1, pages: 0, counts: { Pending: 0, Processing: 0, Approved: 0, Rejected: 0, Completed: 0 }, pendingBookings: 0, upcomingBookings: 0 };
    if (path === "/api/auth/me") json = { user };
    else if (path === "/api/notifications/unread-count") json = { unread: items.filter(item => !item.isRead).length };
    else if (path === "/api/notifications/read-all" && method === "PATCH") { items = items.map(item => ({ ...item, isRead: true })); json = { message: "All notifications marked as read." }; }
    else if (/\/notifications\/[^/]+\/read$/.test(path) && method === "PATCH") {
      const id = path.split("/").at(-2); items = items.map(item => item._id === id ? { ...item, isRead: true } : item); json = { item: items.find(item => item._id === id) };
    } else if (path === "/api/notifications") {
      const read = url.searchParams.get("read"), type = url.searchParams.get("type");
      const filtered = items.filter(item => (!read || item.isRead === (read === "read")) && (!type || item.type === type));
      const limit = Number(url.searchParams.get("limit") || 10), current = Number(url.searchParams.get("page") || 1);
      json = { items: filtered.slice((current - 1) * limit, current * limit), total: filtered.length, unread: items.filter(item => !item.isRead).length, pages: Math.ceil(filtered.length / limit) };
    } else if (path === "/api/admin/dashboard") json = { students: 0, staff: 0, services: 0, totalRequests: 0, statusCounts: { Pending: 0, Processing: 0, Approved: 0, Rejected: 0, Completed: 0 }, trends: [], recentRequests: [] };
    else if (path.endsWith("/complaints/overview")) json = { total: 0, unassigned: 0, inProgress: 0, resolved: 0, highPriority: 0 };
    await route.fulfill({ json });
  });
}
for (const [role, count, dashboard, inbox, target] of [
  ["student", 2, "/dashboard", "/notifications", "/my-requests"],
  ["staff", 3, "/staff", "/staff/notifications", "/staff/requests"],
  ["admin", 105, "/admin", "/admin/notifications", "/admin/requests"],
]) test(`${role}: shared bell, own count, recent items, destination, filters and read actions`, async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await fixtures(page, role, count); await page.goto(dashboard);
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(bell).toHaveCount(1);
  await expect(bell.locator(".notification-count")).toHaveText(count > 99 ? "99+" : String(count));
  await bell.click(); const dropdown = page.getByRole("region", { name: "Notifications dropdown" });
  await expect(dropdown).toContainText(`${count} unread`);
  await expect(dropdown.locator(".notification-item")).toHaveCount(Math.min(count, 5));
  await expect(dropdown.locator(".notification-item").first()).toContainText(`${role} message 1`);
  await page.keyboard.press("Escape"); await expect(dropdown).toHaveCount(0); await expect(bell).toBeFocused();
  await bell.click(); await page.getByRole("heading", { level: 1 }).first().click(); await expect(dropdown).toHaveCount(0);
  await bell.click(); await dropdown.getByRole("link", { name: `${role} update 1`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await bell.click(); await expect(dropdown).toContainText(`${count - 1} unread`);
  await dropdown.getByRole("link", { name: "View all notifications" }).click(); await expect(page).toHaveURL(new RegExp(`${inbox}$`));
  await expect(page.getByRole("heading", { name: `${count - 1} unread`, exact: true })).toBeVisible();
  if (count > 10) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".notifications-page .notification-item").first()).toContainText(`${role} update 11`);
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.locator(".notifications-page .notification-item").first()).toContainText(`${role} update 1`);
  }
  await page.getByLabel("Read status", { exact: true }).selectOption("read");
  await expect(page.locator(".notifications-page .notification-item")).toHaveCount(1);
  await page.getByLabel("Read status", { exact: true }).selectOption("unread");
  await expect(page.locator(".notifications-page .notification-item-unread")).toHaveCount(Math.min(count - 1, 10));
  await page.getByLabel("Notification type", { exact: true }).selectOption("appointment");
  await expect(page.locator(".notifications-page .notification-item").first()).toContainText("appointment");
  await page.getByLabel("Read status", { exact: true }).selectOption("");
  await page.getByLabel("Notification type", { exact: true }).selectOption("");
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 }); await bell.click();
    await expect(dropdown).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await dropdown.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `test-results/notifications-${role}-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await expect(bell.locator(".notification-count")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "0 unread", exact: true })).toBeVisible();
  await page.reload(); await expect(bell.locator(".notification-count")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("empty inbox, loading, API errors, retry and single-read failure", async ({ page }) => {
  await fixtures(page, "student", 0); await page.goto("/dashboard");
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(bell.locator(".notification-count")).toHaveCount(0);
  await bell.click(); const dropdown = page.getByRole("region", { name: "Notifications dropdown" });
  await expect(dropdown).toContainText("You're all caught up. No new notifications.");
  await page.keyboard.press("Escape");
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/api/notifications?limit=5", async route => { await gate; await route.fulfill({ status: 503, json: { message: "Inbox unavailable" } }); });
  await bell.click(); await expect(dropdown).toContainText("Loading notifications..."); release();
  await expect(dropdown.getByRole("alert")).toContainText("Inbox unavailable");
  await page.route("**/api/notifications?limit=5", route => route.fulfill({ json: { items: [{ _id: "a", title: "Request update", message: "Your request changed", type: "request", isRead: false, createdAt: "2026-10-18T00:00:00Z" }], unread: 1 } }));
  await dropdown.getByRole("button", { name: "Retry", exact: true }).click();
  await page.route("**/api/notifications/a/read", route => route.fulfill({ status: 503, json: { message: "Read failed" } }));
  await dropdown.getByRole("link", { name: "Request update", exact: true }).click();
  await expect(dropdown.getByRole("alert")).toContainText("Read failed");
  await expect(page).toHaveURL(/\/dashboard$/);
});
