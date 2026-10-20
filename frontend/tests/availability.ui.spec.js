// Isolated UI contracts. Actual transaction/uniqueness tests live in the backend integration suite.
import { test, expect } from "@playwright/test";
const service = { _id: "111111111111111111111111", name: "Registry guidance", department: "Registry" };
const slot = { _id: "222222222222222222222222", service, serviceName: service.name, title: "Group guidance", staff: { name: "Staff A" }, startsAt: "2099-01-02T03:30:00.000Z", endsAt: "2099-01-02T04:30:00.000Z", capacity: 10, remaining: 9, booked: 1, description: "Bring your documents", location: "Registry Office", status: "Published", updatedAt: "2026-10-20T00:00:00.000Z" };
async function session(page, role) {
  await page.addInitScript(() => localStorage.setItem("token", "isolated-ui-test"));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: { id: "333333333333333333333333", name: "Test User", role, approvalStatus: "approved", email: "test@example.test" } } }));
  await page.route("**/api/notifications/unread-count", route => route.fulfill({ json: { unread: 0 } }));
  await page.route("**/api/services", route => route.fulfill({ json: { services: [service] } }));
}
test("staff creates group availability, edits description and confirms safe deletion", async ({ page }) => {
  await session(page, "staff");
  let current = null;
  await page.route("**/api/staff/appointment-slots?**", route => route.fulfill({ json: { items: current ? [current] : [], total: current ? 1 : 0, pages: 1 } }));
  await page.route("**/api/staff/appointment-slots", async route => {
    const body = route.request().postDataJSON();
    expect(body.capacity).toBe(10); expect(body.description).toBe("Group discussion");
    expect(body.startsAt).toBe("2099-01-02T03:30:00.000Z");
    current = { ...slot, ...body, service, booked: 0, remaining: 10 };
    await route.fulfill({ status: 201, json: { slot: current, message: "Availability published successfully." } });
  });
  await page.route(`**/api/staff/appointment-slots/${slot._id}`, async route => {
    const method = route.request().method();
    if (method === "DELETE") {
      expect(route.request().postDataJSON()).toEqual({ expectedUpdatedAt: current.updatedAt });
      current = null;
      return route.fulfill({ json: { message: "Availability deleted. Active bookings cancelled and affected students notified." } });
    }
    if (method === "PATCH") {
      const body = route.request().postDataJSON();
      expect(body.capacity).toBe(10); expect(body.description).toBe("Updated group discussion");
      current = { ...current, ...body };
      return route.fulfill({ json: { slot: current, message: "Availability updated successfully." } });
    }
    await route.fulfill({ json: { slot: current, bookings: [] } });
  });
  await page.goto("/staff/appointments");
  await page.getByRole("button", { name: "Create Availability", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Service", { exact: true }).selectOption(service._id);
  await dialog.getByLabel("Appointment Title", { exact: true }).fill(slot.title);
  await dialog.getByLabel("Appointment Date", { exact: true }).fill("2099-01-02");
  await dialog.getByLabel("Start Time", { exact: true }).fill("09:00");
  await dialog.getByLabel("End Time", { exact: true }).fill("10:00");
  await dialog.getByLabel("Capacity", { exact: true }).fill("10");
  await dialog.getByLabel("Description (optional)", { exact: true }).fill("Group discussion");
  for (const width of [1280, 820, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await dialog.getByLabel("Capacity", { exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(dialog.getByLabel("Capacity", { exact: true })).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Publish availability", exact: true }).click();
  await expect(page.locator(".appointment-card")).toContainText("10 of 10 spaces available");
  await page.getByRole("button", { name: "View & manage", exact: true }).click();
  await dialog.getByRole("button", { name: "Edit availability", exact: true }).click();
  await dialog.getByLabel("Description (optional)", { exact: true }).fill("Updated group discussion");
  await dialog.getByRole("button", { name: "Save availability", exact: true }).click();
  await expect(page.locator(".appointment-card")).toContainText("Updated group discussion");
  await page.getByRole("button", { name: "View & manage", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete availability", exact: true }).click();
  await expect(dialog).toContainText("Booking history is preserved");
  await expect(page.getByRole("button", { name: "Confirm deletion", exact: true })).toBeVisible();
  expect(current).not.toBeNull();
  await dialog.getByRole("button", { name: "Confirm deletion", exact: true }).click();
  await expect(page.locator(".appointment-card")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("booked availability protects schedule and capacity while preserving details", async ({ page }) => {
  await session(page, "staff");
  await page.route("**/api/staff/appointment-slots?**", route => route.fulfill({ json: { items: [slot], total: 1, pages: 1 } }));
  await page.route(`**/api/staff/appointment-slots/${slot._id}`, route => route.fulfill({ json: { slot, bookings: [] } }));
  await page.goto("/staff/appointments");
  await page.getByRole("button", { name: "View & manage", exact: true }).click();
  await page.getByRole("button", { name: "Edit availability", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const name of ["Capacity", "Service", "Appointment Date", "Start Time", "End Time"]) await expect(dialog.getByLabel(name, { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Description (optional)", { exact: true })).toHaveValue(slot.description);
  await expect(dialog.getByLabel("Location (optional)", { exact: true })).toBeEnabled();
});

test("student uses server expiry time even with an incorrect device clock", async ({ page }) => {
  await page.clock.install({ time: new Date("2050-01-01T00:00:00Z") });
  await session(page, "student");
  const serverNow = "2030-01-01T00:00:00.000Z";
  const ending = { ...slot, startsAt: "2029-12-31T23:59:00.000Z", endsAt: "2030-01-01T00:00:03.000Z" };
  await page.route("**/api/appointments/availability?**", route => route.fulfill({ json: { items: [ending], total: 1, pages: 1, serverNow } }));
  await page.route(/\/api\/appointments\?/, route => route.fulfill({ json: { items: [], total: 0, pages: 0 } }));
  await page.goto("/appointments");
  await expect(page.locator(".appointment-card")).toContainText("9 of 10 spaces available");
  await page.getByRole("button", { name: "Book Appointment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm booking", exact: true })).toBeEnabled();
  await page.clock.runFor(4000);
  await expect(page.locator(".appointment-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm booking", exact: true })).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("This slot is no longer available");
});

test("three different slots can be booked while only booked cards are disabled; cancellation refreshes them", async ({ page }) => {
  await session(page, "student");
  const catalogue = [slot, { ...slot, _id: "444444444444444444444444", title: "Student ID guidance" }, { ...slot, _id: "555555555555555555555555", title: "Certificate guidance" }];
  const bookings = [];
  await page.route("**/api/appointments/availability?**", route => route.fulfill({ json: {
    items: catalogue.map(item => ({ ...item, alreadyBooked: bookings.some(booking => booking.slot._id === item._id && booking.status !== "Cancelled") })), total: 3, pages: 1,
  } }));
  await page.route(/\/api\/appointments(?:\?|$)/, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(bookings.some(booking => booking.slot._id === body.slot && booking.status !== "Cancelled")).toBe(false);
      bookings.push({ _id: "booking" + bookings.length, slot: catalogue.find(item => item._id === body.slot), date: slot.startsAt, reason: body.reason, status: "Pending", updatedAt: slot.updatedAt, createdAt: new Date().toISOString() });
      return route.fulfill({ status: 201, json: { message: "Appointment booked successfully. Awaiting staff approval." } });
    }
    await route.fulfill({ json: { items: bookings, total: bookings.length, pages: 1 } });
  });
  await page.route("**/api/appointments/booking0", async route => {
    expect(route.request().postDataJSON().status).toBe("Cancelled");
    bookings[0].status = "Cancelled";
    await route.fulfill({ json: { message: "Cancelled" } });
  });
  await page.goto("/appointments");
  for (const [index, item] of catalogue.entries()) {
    const card = page.locator(".appointment-card").filter({ hasText: item.title });
    await expect(card.getByRole("button", { name: "Book Appointment", exact: true })).toBeEnabled();
    await card.getByRole("button", { name: "Book Appointment", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Reason", { exact: true }).fill("Service guidance");
    await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
    await expect(page.getByRole("button", { name: "Already Booked", exact: true })).toHaveCount(index + 1);
    await expect(card.getByRole("button", { name: "Already Booked", exact: true })).toBeDisabled();
  }
  await expect(page.getByRole("region", { name: "Active appointments", exact: true }).locator(".appointment-booking")).toHaveCount(3);
  await expect(page.getByText("You already have an active appointment. Complete or cancel it before booking another.", { exact: true })).toHaveCount(0);
  await page.getByRole("region", { name: "Active appointments", exact: true }).getByRole("button", { name: "Cancel booking", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.locator(".appointment-card").filter({ hasText: slot.title }).getByRole("button", { name: "Book Appointment", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Appointment history", exact: true })).toContainText("Cancelled");
});
