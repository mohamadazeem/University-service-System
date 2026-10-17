const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Service = require("../models/service");
const Request = require("../models/Request");
process.env.JWT_SECRET = "staff-test-secret-at-least-32-characters";
const app = require("../app");
const staffId = "111111111111111111111111";
const adminId = "222222222222222222222222";
const requestId = "333333333333333333333333";
const serviceId = "444444444444444444444444";
let server, origin;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
const call = async (path, { user, method = "GET", data, claims = {} } = {}) => {
  const response = await fetch(origin + "/api" + path, {
    method, headers: { "Content-Type": "application/json", ...(user && { Authorization: "Bearer " + jwt.sign({ id: user, ...claims }, process.env.JWT_SECRET) }) },
    ...(data && { body: JSON.stringify(data) }),
  });
  return { status: response.status, ...await response.json() };
};
const account = (overrides = {}) => ({ _id: staffId, role: "staff", active: true, approvalStatus: "approved", ...overrides });
const mockAuth = (t, user = account()) => t.mock.method(User, "findById", () => ({ select: async () => user }));

test("staff registration forces pending staff, normalizes unique ID and hashes password", async (t) => {
  t.mock.method(User, "exists", async () => false);
  let saved;
  t.mock.method(User, "create", async (values) => { saved = values; return values; });
  const result = await call("/auth/staff/register", { method: "POST", data: {
    name: "Lecturer", email: "LECTURER@GMAIL.COM", staffId: " emp-01 ",
    password: "valid-password", role: "admin", approvalStatus: "approved", reviewedBy: adminId, department: "Forged",
  } });
  assert.equal(result.status, 201);
  assert.equal(saved.role, "staff"); assert.equal(saved.approvalStatus, "pending");
  assert.equal(saved.email, "lecturer@gmail.com"); assert.equal(saved.staffId, "EMP-01");
  assert.equal(saved.reviewedBy, undefined); assert.equal(saved.department, undefined);
  assert.ok(await bcrypt.compare("valid-password", saved.password));
  assert.equal(result.password, undefined); assert.equal(result.token, undefined);
});

test("staff registration handles a unique-index race without exposing database fields", async (t) => {
  t.mock.method(User, "exists", async () => false);
  t.mock.method(User, "create", async () => { throw Object.assign(new Error("private database details"), { code: 11000 }); });
  const result = await call("/auth/staff/register", { method: "POST", data: { name: "Staff", email: "staff@gmail.com", staffId: "EMP-2", password: "valid-password" } });
  assert.equal(result.status, 409); assert.ok(!result.message.includes("private"));
});

test("four-field staff registration validates every required field, password policy and duplicate identifiers", async (t) => {
  const valid = { name: "Staff", email: "staff@example.test", password: "valid-password", staffId: "EMP-1" };
  for (const key of Object.keys(valid))
    assert.equal((await call("/auth/staff/register", { method: "POST", data: { ...valid, [key]: undefined } })).status, 400);
  for (const change of [{ password: "short" }, { password: "a".repeat(73) }, { email: "bad" }, { name: "" }, { staffId: "   " }, { staffId: "a".repeat(51) }])
    assert.equal((await call("/auth/staff/register", { method: "POST", data: { ...valid, ...change } })).status, 400);
  t.mock.method(User, "exists", async () => true);
  assert.equal((await call("/auth/staff/register", { method: "POST", data: valid })).status, 409);
  User.exists.mock.restore();
  t.mock.method(User, "exists", async (filter) => Boolean(filter.staffId));
  assert.match((await call("/auth/staff/register", { method: "POST", data: valid })).message, /Staff ID already/);
});

test("pending, rejected, legacy and inactive staff cannot log in; approved staff use existing JWT", async (t) => {
  t.mock.method(bcrypt, "compare", async () => true);
  let user = account({ password: "hashed", email: "staff@example.test" });
  t.mock.method(User, "findOne", () => ({ select: async () => user }));
  for (const status of ["pending", "rejected", undefined]) {
    user.approvalStatus = status;
    const result = await call("/auth/login", { method: "POST", data: { email: user.email, password: "password", portal: "staff" } });
    assert.equal(result.status, 403); assert.equal(result.token, undefined);
    assert.match(result.message, status === "rejected" ? /rejected/ : /awaiting administrator approval/);
  }
  user.approvalStatus = "approved";
  user.active = false;
  assert.equal((await call("/auth/login", { method: "POST", data: { email: user.email, password: "password" } })).status, 401);
  user.active = true;
  const result = await call("/auth/login", { method: "POST", data: { email: user.email, password: "password", portal: "staff" } });
  assert.equal(result.status, 200); assert.equal(result.user.department, undefined);
  assert.equal(jwt.verify(result.token, process.env.JWT_SECRET).id, staffId);
  user.role = "student";
  const wrongPortal = await call("/auth/login", { method: "POST", data: { email: user.email, password: "password", portal: "staff" } });
  assert.equal(wrongPortal.status, 403); assert.match(wrongPortal.message, /does not have staff access/);
});

test("approval is enforced on every session including tokens forged with approved claims", async (t) => {
  const user = account(); mockAuth(t, user);
  for (const status of ["pending", "rejected", undefined]) {
    user.approvalStatus = status;
    assert.equal((await call("/auth/me", { user: staffId, claims: { approvalStatus: "approved", role: "admin" } })).status, 401);
  }
  user.approvalStatus = "approved";
  assert.equal((await call("/auth/me", { user: staffId })).status, 200);
});

test("only admins can review staff, and all staff operations require approved staff", async (t) => {
  const user = account(); mockAuth(t, user);
  for (const role of ["staff", "student"]) {
    user.role = role;
    for (const [path, method] of [["/admin/staff-registrations", "GET"], [`/admin/staff-registrations/${staffId}`, "GET"], [`/admin/staff-registrations/${staffId}`, "PATCH"]])
      assert.equal((await call(path, { user: staffId, method, data: method === "PATCH" ? { approvalStatus: "approved" } : undefined })).status, 403);
  }
  for (const role of ["student", "admin"])
    for (const path of ["/staff/dashboard", "/staff/requests", `/staff/requests/${requestId}`]) {
      user.role = role;
      assert.equal((await call(path, { user: staffId })).status, 403);
    }
  assert.equal((await call("/admin/staff-registrations")).status, 401);
  user.role = "staff";
  for (const path of ["/admin/users", "/admin/services", "/admin/requests"])
    assert.equal((await call(path, { user: staffId })).status, 403);
});

test("approved staff without a department list all requests and receive all-department statistics", async (t) => {
  mockAuth(t);
  const check = (filter) => assert.equal(filter.serviceRef, undefined);
  t.mock.method(Request, "find", (filter) => { check(filter); return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] }; });
  t.mock.method(Request, "countDocuments", async (filter) => { check(filter); return 0; });
  assert.equal((await call("/staff/requests", { user: staffId, claims: { department: "Library", staffId: "Forged" } })).status, 200);
  const summary = await call("/staff/dashboard?department=Library", { user: staffId });
  assert.equal(summary.status, 200); assert.equal(summary.department, undefined);
});

test("approved staff can open and update another department's request by ID", async (t) => {
  mockAuth(t, account({ department: "Registry" }));
  const record = { _id: requestId, student: adminId, status: "Pending", serviceRef: serviceId, serviceDetails: { department: "Library" }, updatedAt: new Date() };
  t.mock.method(Request, "findById", (id) => {
    assert.equal(id, requestId);
    return { populate: async () => record, then: (resolve) => resolve(record) };
  });
  t.mock.method(Request, "findOneAndUpdate", (filter, update) => {
    assert.equal(filter._id, requestId); assert.equal(filter.serviceRef, undefined);
    assert.equal(update.$set.staffComment, "Reviewed across departments");
    return { populate: async () => ({ ...record, ...update.$set }) };
  });
  t.mock.method(require("../utils/notifications"), "tryFlush", async () => {});
  assert.equal((await call(`/staff/requests/${requestId}`, { user: staffId })).request.serviceDetails.department, "Library");
  assert.equal((await call(`/staff/requests/${requestId}`, { user: staffId, method: "PATCH", data: { status: "Processing", expectedStatus: "Pending", staffComment: "Reviewed across departments" } })).status, 200);
});

test("staff cannot mass-assign ownership, service, department, assignment or approval", async (t) => {
  mockAuth(t);
  for (const key of ["student", "service", "serviceRef", "department", "assignedStaff", "approvalStatus", "notificationEvents"])
    assert.equal((await call(`/staff/requests/${requestId}`, { user: staffId, method: "PATCH", data: { [key]: adminId } })).status, 400);
});

test("department is an optional informational request filter for staff and admins", async (t) => {
  const user = account(); mockAuth(t, user);
  t.mock.method(Service, "find", (filter) => {
    assert.deepEqual(filter, { department: "Library" });
    return { select: () => ({ lean: async () => [{ _id: serviceId }] }) };
  });
  const check = (filter) => assert.deepEqual(filter.serviceRef, { $in: [serviceId] });
  t.mock.method(Request, "find", (filter) => { check(filter); return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] }; });
  t.mock.method(Request, "countDocuments", async (filter) => { check(filter); return 0; });
  assert.equal((await call("/staff/requests?department=Library", { user: staffId })).status, 200);
  user.role = "admin";
  assert.equal((await call("/admin/requests?department=Library", { user: staffId })).status, 200);
});

test("staff edits reject stale detail timestamps and invalid status transitions", async (t) => {
  mockAuth(t);
  const updatedAt = new Date("2026-10-17T10:00:00Z");
  const request = { _id: requestId, student: adminId, status: "Pending", updatedAt };
  t.mock.method(Request, "findById", async () => request);
  const patch = (data) => call(`/staff/requests/${requestId}`, { user: staffId, method: "PATCH", data });
  assert.equal((await patch({ staffComment: "Stale", expectedUpdatedAt: "2026-10-17T09:00:00Z" })).status, 409);
  assert.equal((await patch({ staffComment: "Malformed", expectedUpdatedAt: "invalid" })).status, 400);
  assert.equal((await patch({ status: "Completed", expectedStatus: "Pending", expectedUpdatedAt: updatedAt.toISOString() })).status, 409);
  assert.equal((await patch({ status: "Processing", expectedStatus: "Approved" })).status, 409);
});

test("admin review validates fields and uses staff role, expected status and timestamp conditions", async (t) => {
  mockAuth(t, account({ _id: adminId, role: "admin" }));
  const timestamp = new Date().toISOString();
  const body = { approvalStatus: "approved", expectedStatus: "pending", expectedUpdatedAt: timestamp };
  let writes = 0;
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    writes++; assert.equal(filter.role, "staff"); assert.equal(filter._id, staffId);
    assert.equal(filter.updatedAt.toISOString(), timestamp);
    assert.deepEqual(filter.$or, [{ approvalStatus: "pending" }, { approvalStatus: null }]);
    assert.equal(update.$set.reviewedBy, adminId); assert.equal(update.$push.approvalHistory.status, "approved");
    return writes === 1 ? account() : null;
  });
  const review = (data, id = staffId) => call(`/admin/staff-registrations/${id}`, { user: adminId, method: "PATCH", data });
  assert.equal((await review({ ...body, department: "Forged" })).status, 400);
  assert.equal((await review({ ...body, role: "admin" })).status, 400);
  assert.equal((await review(body, adminId)).status, 403);
  assert.equal((await review(body)).status, 200);
  assert.equal((await review(body)).status, 409);
});

test("legacy staff default to pending while students and admins keep their access", () => {
  for (const role of ["student", "admin", "staff"]) {
    const user = new User({ name: "Test", email: "test@example.test", password: "hash", role });
    assert.equal(user.approvalStatus, role === "staff" ? "pending" : undefined);
  }
});
