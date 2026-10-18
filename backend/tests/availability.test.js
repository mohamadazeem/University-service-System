const { test } = require("node:test");
const assert = require("node:assert/strict");
const Slot = require("../models/AppointmentSlot");
const Appointment = require("../models/Appointment");
const controller = require("../controllers/appointmentController");
const owner = "111111111111111111111111", other = "222222222222222222222222";

async function list(t, role, query = {}) {
  let filter, response;
  const record = new Slot({ staff: owner, startsAt: new Date("2020-01-01T06:00:00Z"), capacity: 3, status: "Draft" });
  const chain = { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [record] };
  t.mock.method(Slot, "find", value => { filter = value; return chain; });
  t.mock.method(Slot, "countDocuments", async () => 1);
  t.mock.method(Appointment, "aggregate", async () => [{ _id: record._id, total: 2 }]);
  await controller.list(false)({ user: { id: owner, role }, query }, { json: value => { response = value; } });
  return { filter, response };
}
test("admin availability includes all owners and past drafts with database booking counts", async t => {
  const { filter, response } = await list(t, "admin");
  assert.deepEqual(filter, {});
  assert.equal(response.items[0].booked, 2);
  assert.equal(response.items[0].remaining, 1);
  assert.equal(response.items[0].status, "Draft");
});
test("admin availability combines staff, service, date, publication and literal search filters", async t => {
  const { filter } = await list(t, "admin", { staff: other, service: owner, date: "2030-01-02", status: "Draft", q: "Advice.*" });
  assert.equal(filter.staff, other); assert.equal(filter.service, owner); assert.equal(filter.status, "Draft");
  assert.equal(filter.startsAt.$gte.toISOString(), "2030-01-01T18:30:00.000Z");
  assert.equal(filter.$or[0].title.$regex, "Advice\\.\\*");
});
test("staff query cannot replace authenticated slot ownership", async t => {
  const { filter } = await list(t, "staff", { staff: other });
  assert.equal(filter.staff, owner);
});
test("closed filter includes explicit Closed and legacy inactive availability", async t => {
  const { filter } = await list(t, "admin", { status: "Closed" });
  assert.deepEqual(filter.$and, [{ $or: [{ status: "Closed" }, { active: false, status: { $ne: "Cancelled" } }] }]);
});
