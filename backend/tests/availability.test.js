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
  assert.deepEqual(filter, { deletedAt: null });
  assert.equal(response.items[0].booked, 2);
  assert.equal(response.items[0].remaining, 1);
  assert.equal(response.items[0].status, "Expired");
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

test("expiry uses the end instant, includes the boundary and preserves legacy windows", () => {
  const { endTime, status } = require("../utils/availabilityTime");
  const slot = { startsAt: new Date("2030-01-02T03:30:00Z"), endsAt: new Date("2030-01-02T04:30:00Z"), status: "Published", active: true };
  assert.equal(status(slot, new Date("2030-01-02T04:29:59Z")), "Published");
  assert.equal(status(slot, slot.endsAt), "Expired");
  assert.equal(status({ ...slot, status: "Cancelled", active: false }, slot.endsAt), "Cancelled");
  assert.equal(endTime({ startsAt: slot.startsAt }).toISOString(), "2030-01-02T04:00:00.000Z");
});

test("all students discover the same partially booked availability with backend expiry filters", async t => {
  const User = require("../models/user"), Service = require("../models/service");
  const record = new Slot({ staff: owner, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000), capacity: 10, status: "Published" });
  const filters = [], responses = [];
  t.mock.method(User, "find", () => ({ select: async () => [{ _id: owner }] }));
  t.mock.method(Service, "find", () => ({ select: async () => [] }));
  t.mock.method(Slot, "find", filter => { filters.push(filter); return { populate() { return this; }, sort: async () => [record] }; });
  t.mock.method(Appointment, "aggregate", async () => [{ _id: record._id, total: 2, confirmed: 1, pending: 1 }]);
  t.mock.method(Appointment, "find", () => ({ select: async () => [] }));
  for (const id of [owner, other, "333333333333333333333333"]) {
    await controller.list(true)({ user: { id, role: "student" }, query: {} }, { json: response => responses.push(response) });
  }
  for (const [index, response] of responses.entries()) {
    assert.equal(response.items[0].remaining, 8);
    assert.equal(response.items[0].confirmed, 1);
    assert.equal(response.items[0].pending, 1);
    assert.equal(filters[index].student, undefined);
    assert.equal(filters[index].startsAt, undefined);
    assert.equal(filters[index].deletedAt, null);
    assert.ok(filters[index].$expr.$gt[1] instanceof Date);
    assert.ok(response.serverNow);
  }
});

test("deletion keeps booking history and atomically cancels reservations with durable student notices", async t => {
  const mongoose = require("mongoose"), User = require("../models/user");
  const record = new Slot({ staff: owner, startsAt: new Date(Date.now() + 86400000), capacity: 10 });
  record.updatedAt = new Date();
  const booking = new Appointment({ slot: record._id, student: other, staff: owner, date: record.startsAt, time: "09:00", reason: "Guidance", status: "Approved", activeReservation: true });
  let scope, operations, response, saved = false;
  const session = {};
  t.mock.method(mongoose.connection, "transaction", async callback => callback(session));
  t.mock.method(Slot, "findOne", filter => { scope = filter; return { session: async () => record }; });
  t.mock.method(record, "save", async options => { assert.equal(options.session, session); saved = true; });
  t.mock.method(User, "updateOne", async () => ({}));
  t.mock.method(Appointment, "find", () => ({ select() { return this; }, session: async () => [booking] }));
  t.mock.method(Appointment, "bulkWrite", async (items, options) => { operations = items; assert.equal(options.session, session); });
  t.mock.method(require("../utils/notifications"), "flush", async () => {});
  await controller.remove({ user: { id: owner, role: "staff" }, params: { id: String(record._id) }, body: { expectedUpdatedAt: record.updatedAt.toISOString() } }, { json: result => { response = result; } });
  assert.equal(scope.staff, owner); assert.equal(scope.deletedAt, null);
  assert.equal(saved, true); assert.ok(record.deletedAt); assert.equal(record.active, false);
  assert.equal(record.status, "Cancelled");
  assert.equal(operations.length, 1);
  const update = operations[0].updateOne.update;
  assert.deepEqual(update.$set, { status: "Cancelled", activeReservation: false });
  assert.equal(update.$unset.reservedSlot, 1);
  assert.equal(update.$push.history.status, "Cancelled");
  assert.ok(update.$push.notificationEvents.$each.some(notice => String(notice.user) === other));
  assert.match(response.message, /deleted/);
});

test("staff cannot delete another owner's availability", async t => {
  const mongoose = require("mongoose");
  let scope;
  t.mock.method(mongoose.connection, "transaction", async callback => callback({}));
  t.mock.method(Slot, "findOne", filter => { scope = filter; return { session: async () => null }; });
  await assert.rejects(controller.remove({ user: { id: owner, role: "staff" }, params: { id: other }, body: { expectedUpdatedAt: new Date().toISOString() } }, {}), error => error.status === 404);
  assert.equal(scope.staff, owner);
});

for (const status of ["Pending", "Approved", "In Progress", "Completed"]) test(`the same student cannot repeat a slot with a ${status} booking`, async t => {
  const mongoose = require("mongoose"), User = require("../models/user");
  const slot = new Slot({ staff: other, startsAt: new Date(Date.now() + 86400000), capacity: 10 });
  t.mock.method(mongoose.connection, "transaction", async callback => callback({}));
  t.mock.method(Slot, "findOneAndUpdate", async () => slot);
  t.mock.method(User, "exists", () => ({ session: async () => ({ _id: other }) }));
  t.mock.method(Appointment, "exists", filter => ({ session: async () => {
    assert.equal(filter.student, owner); assert.equal(String(filter.slot), String(slot._id));
    assert.ok(filter.status.$in.includes(status)); return { _id: other };
  } }));
  await assert.rejects(controller.book({ user: { id: owner, role: "student" }, body: { slot: String(slot._id), reason: "Repeat slot" } }, {}), error => error.status === 409 && /already have a booking/.test(error.message));
});

test("completed slots are excluded only for the attendee, and no longer block other availability", async t => {
  const User = require("../models/user"), Service = require("../models/service");
  const completedSlot = new Slot({ staff: other, startsAt: new Date(Date.now() + 86400000), capacity: 10 });
  const differentSlot = new Slot({ staff: other, startsAt: new Date(Date.now() + 90000000), capacity: 10 });
  t.mock.method(User, "find", () => ({ select: async () => [{ _id: other }] }));
  t.mock.method(Service, "find", () => ({ select: async () => [] }));
  t.mock.method(Appointment, "find", filter => ({ select: async () => filter.student === owner ? [{ slot: completedSlot._id, status: "Completed" }] : [] }));
  t.mock.method(Slot, "find", filter => ({ populate() { return this; }, sort: async () => [completedSlot, differentSlot].filter(slot => !(filter._id?.$nin || []).some(id => String(id) === String(slot._id))) }));
  t.mock.method(Appointment, "aggregate", async () => [{ _id: completedSlot._id, total: 1, confirmed: 1 }]);
  const responses = [];
  for (const id of [owner, other]) await controller.list(true)({ user: { id, role: "student" }, query: {} }, { json: result => responses.push(result) });
  assert.deepEqual(responses[0].items.map(slot => String(slot._id)), [String(differentSlot._id)]);
  assert.equal(responses[0].hasActiveAppointment, undefined);
  assert.equal(responses[1].items.length, 2);
  assert.equal(responses[1].items[0].remaining, 9);
});

test("only a student's own booked slot is marked Already Booked", async t => {
  const User = require("../models/user"), Service = require("../models/service");
  const slots = [1, 2].map(() => new Slot({ staff: other, startsAt: new Date(Date.now() + 86400000), capacity: 10 }));
  t.mock.method(User, "find", () => ({ select: async () => [{ _id: other }] }));
  t.mock.method(Service, "find", () => ({ select: async () => [] }));
  t.mock.method(Appointment, "find", filter => ({ select: async () => filter.student === owner ? [{ slot: slots[0]._id, status: "Pending" }] : [] }));
  t.mock.method(Slot, "find", () => ({ populate() { return this; }, sort: async () => slots }));
  t.mock.method(Appointment, "aggregate", async () => [{ _id: slots[0]._id, total: 1 }]);
  const responses = [];
  for (const id of [owner, other]) await controller.list(true)({ user: { id, role: "student" }, query: {} }, { json: response => responses.push(response) });
  assert.deepEqual(responses[0].items.map(slot => slot.alreadyBooked), [true, false]);
  assert.deepEqual(responses[1].items.map(slot => slot.alreadyBooked), [false, false]);
});

for (const terminal of ["Pending", "Approved", "In Progress", "Completed", "Cancelled", "Rejected"]) test(`${terminal} history permits a different appointment without deleting the old record`, async t => {
  const mongoose = require("mongoose"), User = require("../models/user");
  const session = {}, oldSlot = new mongoose.Types.ObjectId();
  const slot = new Slot({ staff: other, startsAt: new Date(Date.now() + 86400000), capacity: 10 });
  const history = { slot: oldSlot, student: owner, status: terminal };
  t.mock.method(mongoose.connection, "transaction", async callback => callback(session));
  t.mock.method(User, "updateOne", async () => ({ matchedCount: 1 }));
  t.mock.method(User, "exists", () => ({ session: async () => ({ _id: other }) }));
  t.mock.method(Slot, "findOneAndUpdate", async () => slot);
  t.mock.method(Appointment, "exists", filter => ({ session: async () => filter.status.$in.includes(history.status) && (!filter.slot || String(filter.slot) === String(history.slot)) ? history : null }));
  t.mock.method(Appointment, "countDocuments", () => ({ session: async () => 0 }));
  t.mock.method(Appointment, "create", async (records, options) => { assert.equal(options.session, session); return records.map(record => new Appointment(record)); });
  t.mock.method(require("../utils/notifications"), "flush", async () => {});
  let response;
  await controller.book({ user: { id: owner, role: "student" }, body: { slot: String(slot._id), reason: "Another appointment" } }, { status(code) { assert.equal(code, 201); return this; }, json(result) { response = result; } });
  assert.equal(response.appointment.status, "Pending"); assert.equal(history.status, terminal);
});
