const Request = require("../models/Request");
const User = require("../models/user");
const v = require("../utils/validation");
const { statuses, transitions } = require("../utils/requestStatus");
const populate = [
  { path: "student", select: "name email studentId phone" },
  { path: "assignedStaff", select: "name email role active" },
];
const listRequests = async (req, res) => {
  const p = v.paging(req.query, [
    "createdAt",
    "updatedAt",
    "service",
    "status",
    "priority",
  ]);
  const filter = { ...req.requestScope };
  if (req.query.status)
    filter.status = v.choice(req.query.status, statuses, "status");
  if (req.query.priority)
    filter.priority = v.choice(
      req.query.priority,
      ["Normal", "Urgent"],
      "priority",
    );
  if (req.query.service)
    filter.service = v.text(req.query.service, "Service", 120);
  for (const [key, operator] of [
    ["from", "$gte"],
    ["to", "$lte"],
  ]) {
    if (req.query[key]) {
      const date = v.text(req.query[key], "Date", 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        v.fail("Use a valid YYYY-MM-DD date");
      filter.createdAt = {
        ...filter.createdAt,
        [operator]: new Date(
          date + (key === "to" ? "T23:59:59.999Z" : "T00:00:00.000Z"),
        ),
      };
    }
  }
  if (filter.createdAt?.$gte > filter.createdAt?.$lte)
    v.fail("Start date must be before end date");
  if (req.query.q) {
    const search = v.text(req.query.q, "Search", 100);
    const regex = { $regex: v.escapeRegex(search), $options: "i" };
    const students = await User.find({
      $or: [{ name: regex }, { email: regex }],
    })
      .select("_id")
      .lean();
    filter.$or = [
      { service: regex },
      { studentId: regex },
      { student: { $in: students.map((user) => user._id) } },
    ];
    if (/^[a-f\d]{24}$/i.test(search)) filter.$or.push({ _id: search });
  }
  const [items, total] = await Promise.all([
    Request.find(filter)
      .populate(populate)
      .sort(p.sort)
      .skip(p.skip)
      .limit(p.limit),
    Request.countDocuments(filter),
  ]);
  res.json({ items, total, page: p.page, pages: Math.ceil(total / p.limit) });
};
const getRequest = async (req, res) => {
  const recordId = v.id(req.params.id);
  const query = req.requestScope ? Request.findOne({ _id: recordId, ...req.requestScope }) : Request.findById(recordId);
  const request = await query.populate(
    populate,
  );
  if (!request) v.fail("Request not found", 404);
  res.json({ request, allowedStatuses: transitions[request.status] });
};
const updateRequest = async (req, res) => {
  v.body(req.body, req.user.role === "staff" ? ["status", "expectedStatus", "expectedUpdatedAt", "staffComment"] : [
    "status",
    "expectedStatus",
    "expectedUpdatedAt",
    "assignedStaff",
    "staffComment",
  ]);
  const recordId = v.id(req.params.id);
  const request = req.requestScope
    ? await Request.findOne({ _id: recordId, ...req.requestScope })
    : await Request.findById(recordId);
  if (!request) v.fail("Request not found", 404);
  const values = {};
  if (req.body.expectedUpdatedAt !== undefined) {
    const timestamp = v.text(req.body.expectedUpdatedAt, "Last updated timestamp", 40);
    if (Number.isNaN(Date.parse(timestamp))) v.fail("Invalid last updated timestamp");
    if (new Date(timestamp).getTime() !== request.updatedAt?.getTime())
      v.fail("This request changed. Reload its details.", 409);
  }
  if (req.body.status !== undefined) {
    values.status = v.choice(req.body.status, statuses, "status");
    v.choice(req.body.expectedStatus, statuses, "expected status");
    if (req.body.expectedStatus !== request.status)
      v.fail("This request changed. Reload its details.", 409);
    if (
      values.status !== request.status &&
      !transitions[request.status].includes(values.status)
    )
      v.fail("This status transition is not permitted", 409);
  }
  if (req.body.assignedStaff !== undefined) {
    if (req.body.assignedStaff === null || req.body.assignedStaff === "")
      values.assignedStaff = null;
    else {
      values.assignedStaff = v.id(req.body.assignedStaff);
      if (
        !(await User.exists({
          _id: values.assignedStaff,
          role: "staff",
          active: { $ne: false },
          approvalStatus: "approved",
        }))
      )
        v.fail("Choose an active staff member");
    }
  }
  if (req.body.staffComment !== undefined)
    values.staffComment = v.text(
      req.body.staffComment,
      "Staff comment",
      2000,
      false,
    );
  if (!Object.keys(values).length) v.fail("No changes provided");
  // The condition prevents overwriting a concurrent status update.
  const updated = await Request.findOneAndUpdate(
    { _id: recordId, status: request.status, updatedAt: request.updatedAt, ...req.requestScope },
    { $set: values, $push: { notificationEvents: require("../utils/notificationEvent").event(request.student, `Your service request was updated${values.status ? ": " + values.status : ""}.`) } },
    { returnDocument: "after", runValidators: true },
  ).populate(populate);
  if (!updated) v.fail("This request changed. Reload its details.", 409);
  await require("../utils/notifications").tryFlush(Request, request.student.toString());
  res.json({
    message: "Request updated",
    request: updated,
    allowedStatuses: transitions[updated.status],
  });
};
module.exports = { listRequests, getRequest, updateRequest };
