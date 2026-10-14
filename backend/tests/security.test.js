const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Service = require("../models/service");
const Request = require("../models/Request");
const v = require("../utils/validation");
process.env.JWT_SECRET = "unit-tests-only-secret-at-least-32-characters";
const app = require("../app");
const adminId = "111111111111111111111111";
const studentId = "222222222222222222222222";
const recordId = "333333333333333333333333";
const accounts = {
  [adminId]: {
    _id: adminId,
    role: "admin",
    name: "Admin",
    email: "admin@example.test",
    active: true,
  },
  [studentId]: {
    _id: studentId,
    role: "student",
    name: "Student",
    email: "student@example.test",
    active: true,
  },
};
let server, origin;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
afterEach(() => {
  accounts[studentId].active = true;
  accounts[studentId].role = "student";
});
const call = async (path, options = {}) => {
  const { user, data, method = "GET", token } = options;
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user || token
        ? {
            Authorization: `Bearer ${token || jwt.sign({ id: user }, process.env.JWT_SECRET)}`,
          }
        : {}),
    },
    ...(data !== undefined && { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
};
const mockAccounts = (t) =>
  t.mock.method(User, "findById", (value) => ({
    select: async () => accounts[value],
  }));
test("unauthenticated access to every admin resource is refused", async () => {
  for (const path of ["dashboard", "requests", "users", "services", "staff"])
    assert.equal((await call("/api/admin/" + path)).status, 401);
});
test("student cannot access admin reads or writes, even with an admin role claim", async (t) => {
  mockAccounts(t);
  const token = jwt.sign(
    { id: studentId, role: "admin" },
    process.env.JWT_SECRET,
  );
  for (const [path, method] of [
    ["dashboard", "GET"],
    ["requests", "GET"],
    ["services", "POST"],
    ["users/" + recordId + "/role", "PATCH"],
  ]) {
    assert.equal(
      (
        await call("/api/admin/" + path, {
          token,
          method,
          data: method === "GET" ? undefined : { role: "admin" },
        })
      ).status,
      403,
    );
  }
});
test("expired tokens, invalid subjects and deactivated accounts are rejected", async (t) => {
  mockAccounts(t);
  const expired = jwt.sign({ id: studentId }, process.env.JWT_SECRET, {
    expiresIn: -1,
  });
  assert.equal((await call("/api/auth/me", { token: expired })).status, 401);
  assert.equal(
    (
      await call("/api/auth/me", {
        token: jwt.sign({ id: "bad-id" }, process.env.JWT_SECRET),
      })
    ).status,
    401,
  );
  accounts[studentId].active = false;
  assert.equal((await call("/api/auth/me", { user: studentId })).status, 401);
});
test("public registration ignores privileged role and active fields and hashes passwords", async (t) => {
  t.mock.method(User, "exists", async () => false);
  let saved;
  t.mock.method(User, "create", async (values) => {
    saved = values;
    return { ...values, _id: studentId };
  });
  const result = await call("/api/auth/register", {
    method: "POST",
    data: {
      name: "Student",
      email: "NEW@EXAMPLE.TEST",
      password: "valid-password",
      role: "admin",
      active: false,
    },
  });
  assert.equal(result.status, 201);
  assert.equal(saved.role, "student");
  assert.equal(saved.email, "new@example.test");
  assert.equal(saved.active, undefined);
  assert.ok(await bcrypt.compare("valid-password", saved.password));
  assert.equal(result.body.user.password, undefined);
});
test("registration validates email and bcrypt byte limits before writing", async () => {
  assert.equal(
    (
      await call("/api/auth/register", {
        method: "POST",
        data: { name: "Name", email: "invalid", password: "valid-password" },
      })
    ).status,
    400,
  );
  assert.throws(() => v.password("😀".repeat(20)), /72 bytes/);
});
test("invalid IDs, filters and mass assignment are rejected", async (t) => {
  mockAccounts(t);
  assert.equal(
    (await call("/api/admin/services/not-an-id", { user: adminId })).status,
    400,
  );
  assert.equal(
    (await call("/api/admin/users?role=superuser", { user: adminId })).status,
    400,
  );
  assert.equal(
    (await call("/api/admin/requests?from=2026-02-30", { user: adminId }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("/api/admin/requests?from=2026-10-15&to=2026-01-01", {
        user: adminId,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/api/admin/services?sort=password", { user: adminId })).status,
    400,
  );
  assert.equal(
    (await call("/api/admin/users?limit=99999", { user: adminId })).status,
    400,
  );
  assert.equal(
    (
      await call("/api/admin/services/" + recordId, {
        user: adminId,
        method: "PATCH",
        data: { $set: { active: true } },
      })
    ).status,
    400,
  );
});
test("service validation, duplicate handling and safe delete use whitelisted values", async (t) => {
  mockAccounts(t);
  t.mock.method(Service, "exists", async () => true);
  const duplicate = await call("/api/admin/services", {
    user: adminId,
    method: "POST",
    data: {
      name: "Service",
      department: "Registry",
      description: "Description",
    },
  });
  assert.equal(duplicate.status, 409);
  let update;
  t.mock.method(Service, "findByIdAndUpdate", async (id, values) => {
    update = values;
    return { _id: id, active: false };
  });
  assert.equal(
    (
      await call("/api/admin/services/" + recordId, {
        user: adminId,
        method: "DELETE",
      })
    ).status,
    200,
  );
  assert.deepEqual(update, { $set: { active: false } });
});
test("terminal request states and stale edits cannot be changed", async (t) => {
  mockAccounts(t);
  t.mock.method(Request, "findById", async () => ({ status: "Completed" }));
  assert.equal(
    (
      await call("/api/admin/requests/" + recordId, {
        user: adminId,
        method: "PATCH",
        data: { status: "Pending", expectedStatus: "Completed" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/admin/requests/" + recordId, {
        user: adminId,
        method: "PATCH",
        data: { status: "Completed", expectedStatus: "Pending" },
      })
    ).status,
    409,
  );
});
test("administrators cannot deactivate themselves or demote any existing admin", async (t) => {
  // The controller receives a promise; protect receives its select() projection.
  t.mock.method(User, "findById", (value) => {
    const promise = Promise.resolve(accounts[value]);
    promise.select = async () => accounts[value];
    return promise;
  });
  assert.equal(
    (
      await call("/api/admin/users/" + adminId, {
        user: adminId,
        method: "DELETE",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/admin/users/" + adminId + "/role", {
        user: adminId,
        method: "PATCH",
        data: { role: "student" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/admin/users/" + adminId, {
        user: adminId,
        method: "PATCH",
        data: { active: false },
      })
    ).status,
    409,
  );
});
test("unexpected errors and malformed JSON never expose internal details", async (t) => {
  t.mock.method(User, "exists", async () => {
    throw new Error("private database detail");
  });
  const response = await call("/api/auth/register", {
    method: "POST",
    data: {
      name: "Test",
      email: "test@example.test",
      password: "valid-password",
    },
  });
  assert.equal(response.status, 500);
  assert.ok(!JSON.stringify(response.body).includes("private"));
  const malformed = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
});
