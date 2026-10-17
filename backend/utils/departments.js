const Service = require("../models/service");
const v = require("./validation");
// Services are the existing authoritative department catalogue, including
// inactive services whose historical requests still need processing.
const list = async () => (await Service.distinct("department"))
  .filter((name) => typeof name === "string" && name.trim() && name.length <= 120)
  .sort((a, b) => a.localeCompare(b));
const validate = async (input) => {
  const department = v.text(input, "Department", 120);
  if (!(await list()).includes(department))
    v.fail("Choose a department from the university service catalogue");
  return department;
};
module.exports = { list, validate };
