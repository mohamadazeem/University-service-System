const mongoose = require("mongoose");
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new HttpError(status, message);
};
const text = (value, label, max = 200, required = true) => {
  if (value === undefined && !required) return undefined;
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > max
  )
    fail(
      `${label} must be ${required ? "non-empty " : ""}text of at most ${max} characters`,
    );
  return value.trim();
};
const id = (value) => {
  if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value))
    fail("Invalid record ID");
  return value;
};
const choice = (value, allowed, label) => {
  if (!allowed.includes(value)) fail(`Invalid ${label}`);
  return value;
};
const boolean = (value, label) => {
  if (typeof value !== "boolean") fail(`${label} must be true or false`);
  return value;
};
const body = (value, allowed) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Object.keys(value).length
  )
    fail("Provide a request body");
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    fail("Request contains unsupported fields");
  return value;
};
const email = (value) => {
  const normalized = text(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    fail("Provide a valid email address");
  return normalized;
};
const password = (value) => {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    Buffer.byteLength(value, "utf8") > 72
  )
    fail("Password must contain at least 8 characters and at most 72 bytes");
  return value;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const paging = (query, sortFields) => {
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (
      typeof value !== "string" ||
      !/^\d+$/.test(value) ||
      Number(value) < 1 ||
      Number(value) > max
    )
      fail("Invalid pagination");
    return Number(value);
  };
  const page = number(query.page, 1, 100000);
  const limit = number(query.limit, 10, 100);
  const field =
    query.sort === undefined
      ? "createdAt"
      : choice(query.sort, sortFields, "sort field");
  const direction =
    query.order === undefined
      ? "desc"
      : choice(query.order, ["asc", "desc"], "sort order");
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: { [field]: direction === "asc" ? 1 : -1, _id: 1 },
  };
};
module.exports = {
  HttpError,
  fail,
  text,
  id,
  choice,
  boolean,
  body,
  email,
  password,
  escapeRegex,
  paging,
};
