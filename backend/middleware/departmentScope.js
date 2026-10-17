const Service = require("../models/service");
const v = require("../utils/validation");
module.exports = async (req, res, next) => {
  if (!req.user.department || typeof req.user.department !== "string")
    v.fail("Your staff account has no assigned department. Contact an administrator.", 403);
  const services = await Service.find({ department: req.user.department }).select("_id").lean();
  if (!services.length)
    v.fail("Your department is not configured in the service catalogue. Contact an administrator.", 403);
  // Unlinked legacy requests are deliberately excluded: names are not authority.
  req.requestScope = { serviceRef: { $in: services.map((service) => service._id) } };
  next();
};
