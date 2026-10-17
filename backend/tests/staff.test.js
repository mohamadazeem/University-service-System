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
const account = (overrides = {}) => ({ _id: staffId, role: "staff", active: true, department: "Registry", approvalStatus: "approved", ...overrides });
const mockAuth = (t, user = account()) => t.mock.method(User, "findById", () => ({ select: async () => user }));
const mockServices = (t) => t.mock.method(Service, "find", (filter) => {
  assert.deepEqual(filter, { department: "Registry" });
  return { select: () => ({ lean: async () => [{ _id: serviceId }] }) };
});

test("staff registration forces pending staff, normalizes unique ID and hashes password", async (t) => {
  t.mock.method(Service, "distinct", async () => ["Registry"]);
  t.mock.method(User, "exists", async () => false);
  let saved;
  t.mock.method(User, "create", async (values) => { saved = values; return values; });
  const result = await call("/auth/staff/register", { method: "POST", data: {
    name: "Lecturer", email: "LECTURER@EXAMPLE.TEST", staffId: " emp-01 ", department: "Registry",
    password: "valid-password", confirmPassword: "valid-password", role: "admin", approvalStatus: "approved", reviewedBy: adminId,
  } });
  assert.equal(result.status, 201);
  assert.equal(saved.role, "staff"); assert.equal(saved.approvalStatus, "pending");
  assert.equal(saved.email, "lecturer@example.test"); assert.equal(saved.staffId, "EMP-01");
  assert.equal(saved.reviewedBy, undefined);
  assert.ok(await bcrypt.compare("valid-password", saved.password));
  assert.equal(result.password, undefined); assert.equal(result.token, undefined);
});

test("staff registration rejects invalid passwords, confirmation, department and duplicate identifiers", async (t) => {
  t.mock.method(Service, "distinct", async () => ["Registry"]);
  const valid = { name: "Staff", email: "staff@example.test", password: "valid-password", confirmPassword: "valid-password", department: "Registry", staffId: "EMP-1" };
  for (const change of [{ password: "short" }, { email: "bad" }, { name: "" }, { confirmPassword: "different" }, { department: "Forged" }])
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
  assert.equal(result.status, 200); assert.equal(result.user.department, "Registry");
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
});

test("staff request list and statistics use database department, ignoring browser department", async (t) => {
  mockAuth(t); mockServices(t);
  const check = (filter) => assert.deepEqual(filter.serviceRef, { $in: [serviceId] });
  t.mock.method(Request, "find", (filter) => { check(filter); return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] }; });
  t.mock.method(Request, "countDocuments", async (filter) => { check(filter); return 0; });
  assert.equal((await call("/staff/requests?department=Library", { user: staffId, claims: { department: "Library" } })).status, 200);
  const summary = await call("/staff/dashboard?department=Library", { user: staffId });
  assert.equal(summary.status, 200); assert.equal(summary.department, "Registry");
});

test("cross-department request IDs are denied for both reads and writes", async (t) => {
  mockAuth(t); mockServices(t);
  t.mock.method(Request, "findOne", (filter) => {
    assert.equal(filter._id, requestId);
    assert.deepEqual(filter.serviceRef, { $in: [serviceId] });
    return { populate: async () => null, then: (resolve) => resolve(null) };
  });
  assert.equal((await call(`/staff/requests/${requestId}`, { user: staffId })).status, 404);
  assert.equal((await call(`/staff/requests/${requestId}`, { user: staffId, method: "PATCH", data: { staffComment: "Forged" } })).status, 404);
});

test("staff cannot mass-assign ownership, service, department, assignment or approval", async (t) => {
  mockAuth(t); mockServices(t);
  for (const key of ["student", "service", "serviceRef", "department", "assignedStaff", "approvalStatus", "notificationEvents"])
    assert.equal((await call(`/staff/requests/${requestId}`, { user: staffId, method: "PATCH", data: { [key]: adminId } })).status, 400);
});

test("missing or unconfigured staff department fails closed", async (t) => {
  const user = account({ department: undefined }); mockAuth(t, user);
  assert.equal((await call("/staff/requests", { user: staffId })).status, 403);
  user.department = "Registry";
  t.mock.method(Service, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  assert.equal((await call("/staff/dashboard", { user: staffId })).status, 403);
});

test("staff edits reject stale detail timestamps and invalid status transitions", async (t) => {
  mockAuth(t); mockServices(t);
  const updatedAt = new Date("2026-10-17T10:00:00Z");
  const request = { _id: requestId, student: adminId, status: "Pending", updatedAt };
  t.mock.method(Request, "findOne", async () => request);
  const patch = (data) => call(`/staff/requests/${requestId}`, { user: staffId, method: "PATCH", data });
  assert.equal((await patch({ staffComment: "Stale", expectedUpdatedAt: "2026-10-17T09:00:00Z" })).status, 409);
  assert.equal((await patch({ staffComment: "Malformed", expectedUpdatedAt: "invalid" })).status, 400);
  assert.equal((await patch({ status: "Completed", expectedStatus: "Pending", expectedUpdatedAt: updatedAt.toISOString() })).status, 409);
  assert.equal((await patch({ status: "Processing", expectedStatus: "Approved" })).status, 409);
});

test("admin review validates fields and uses staff role, expected status and timestamp conditions", async (t) => {
  mockAuth(t, account({ _id: adminId, role: "admin" }));
  t.mock.method(Service, "distinct", async () => ["Registry"]);
  const timestamp = new Date().toISOString();
  const body = { approvalStatus: "approved", expectedStatus: "pending", expectedUpdatedAt: timestamp, department: "Registry" };
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
