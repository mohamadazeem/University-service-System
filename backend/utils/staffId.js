const v = require("./validation");
const normalize = (value) => typeof value === "string" ? value.trim().toUpperCase() || undefined : value;
const validate = (value) => v.text(normalize(value), "Staff ID", 50);
module.exports = { normalize, validate };
