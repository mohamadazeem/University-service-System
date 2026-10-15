const { test } = require("node:test");
const assert = require("node:assert/strict");
const startupError = require("../utils/startupError");

test("startup diagnostics distinguish configuration, DNS, network and authentication failures", () => {
  for (const [error, expected] of [
    [{ code: "EADDRINUSE" }, /port is already in use/],
    [new Error("MONGO_URI is required"), /MONGO_URI is missing/],
    [new Error("JWT_SECRET must contain at least 32 characters"), /JWT_SECRET must contain/],
    [{ code: "ETIMEOUT", syscall: "querySrv" }, /DNS lookup failed/],
    [{ cause: { syscall: "queryTxt" } }, /DNS lookup failed/],
    [{ name: "MongooseServerSelectionError" }, /IP allowlist/],
    [{ code: 18 }, /authentication failed/],
    [{ cause: { code: 18 } }, /authentication failed/],
  ]) assert.match(startupError(error), expected);
});

test("startup diagnostics never echo driver messages containing credentials", () => {
  for (const name of ["Error", "MongoNetworkError", "MongooseServerSelectionError"]) {
    const message = startupError({ name, message: "mongodb://private-user:private-password@host/db" });
    assert.ok(!message.includes("private-"));
    assert.ok(!message.includes("mongodb://"));
  }
});
