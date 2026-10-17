const Service = require("../models/service");
// Services are the existing authoritative department catalogue, including
// inactive services whose historical requests still need processing.
const list = async () => (await Service.distinct("department"))
  .filter((name) => typeof name === "string" && name.trim() && name.length <= 120)
  .sort((a, b) => a.localeCompare(b));
module.exports = { list };
