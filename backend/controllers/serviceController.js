const Service = require("../models/service");
const v = require("../utils/validation");
const fields = [
  "name",
  "description",
  "department",
  "processingTime",
  "active",
];
const serviceInput = (input, partial = false) => {
  v.body(input, fields);
  const values = {};
  for (const [key, max] of [
    ["name", 120],
    ["description", 2000],
    ["department", 120],
  ]) {
    if (!partial || input[key] !== undefined)
      values[key] = v.text(input[key], key, max);
  }
  if (input.processingTime !== undefined)
    values.processingTime = v.text(
      input.processingTime,
      "Processing time",
      120,
      false,
    );
  if (input.active !== undefined)
    values.active = v.boolean(input.active, "Active");
  if (values.name) values.nameKey = values.name.toLowerCase();
  return values;
};
const checkDuplicate = async (name, excludedId) => {
  const filter = {
    name: { $regex: `^${v.escapeRegex(name)}$`, $options: "i" },
  };
  if (excludedId) filter._id = { $ne: excludedId };
  if (await Service.exists(filter))
    v.fail("A service with this name already exists", 409);
};
const listServices = async (req, res) => {
  const p = v.paging(req.query, [
    "createdAt",
    "name",
    "department",
    "updatedAt",
  ]);
  const filter = {};
  if (req.query.q) {
    const q = v.escapeRegex(v.text(req.query.q, "Search", 100));
    filter.$or = ["name", "department", "description"].map((field) => ({
      [field]: { $regex: q, $options: "i" },
    }));
  }
  if (req.query.active !== undefined)
    filter.active =
      v.choice(req.query.active, ["true", "false"], "availability") === "true"
        ? { $ne: false }
        : false;
  const [items, total] = await Promise.all([
    Service.find(filter).sort(p.sort).skip(p.skip).limit(p.limit),
    Service.countDocuments(filter),
  ]);
  res.json({ items, total, page: p.page, pages: Math.ceil(total / p.limit) });
};
const getService = async (req, res) => {
  const service = await Service.findById(v.id(req.params.id));
  if (!service) v.fail("Service not found", 404);
  res.json({ service });
};
const createService = async (req, res) => {
  const values = serviceInput(req.body);
  await checkDuplicate(values.name);
  const service = await Service.create(values);
  res.status(201).json({
    message: "Service created",
    service: service.toObject({
      transform: (doc, ret) => {
        delete ret.nameKey;
        return ret;
      },
    }),
  });
};
const updateService = async (req, res) => {
  const recordId = v.id(req.params.id);
  const values = serviceInput(req.body, true);
  if (values.name) await checkDuplicate(values.name, recordId);
  const service = await Service.findByIdAndUpdate(
    recordId,
    { $set: values },
    { returnDocument: "after", runValidators: true },
  );
  if (!service) v.fail("Service not found", 404);
  res.json({ message: "Service updated", service });
};
const deleteService = async (req, res) => {
  // Deactivation is deliberate: historical name snapshots and references stay intact.
  const service = await Service.findByIdAndUpdate(
    v.id(req.params.id),
    { $set: { active: false } },
    { returnDocument: "after" },
  );
  if (!service) v.fail("Service not found", 404);
  res.json({
    message: "Service deactivated. Historical requests are preserved.",
    service,
  });
};
const publicServices = async (req, res) => {
  const services = await Service.find({ active: { $ne: false } }).sort({
    name: 1,
  });
  res.json({ services });
};
module.exports = {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  publicServices,
};
