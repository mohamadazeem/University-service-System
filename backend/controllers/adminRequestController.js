const Request = require("../models/Request");
const User = require("../models/user");
const Service = require("../models/service");
const v = require("../utils/validation");
const requestScope = require("../utils/requestScope");
const { statuses, transitions } = require("../utils/requestStatus");
const populate = [
  { path: "student", select: "name email studentId phone" },
  { path: "assignedStaff", select: "name email role active" },
  { path: "serviceDetails", select: "name department description" },
];
const listRequests = async (req, res) => {
  const p = v.paging(req.query, [
    "createdAt",
    "updatedAt",
    "service",
    "status",
    "priority",
  ]);
  const filter = requestScope(req.user);
  if (req.query.department) {
    const department = v.text(req.query.department, "Department", 120);
    const services = await Service.find({ department }).select("_id").lean();
    filter.serviceRef = { $in: services.map((service) => service._id) };
  }
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
  const query = req.user.role === "staff"
    ? Request.findOne({ _id: recordId, ...requestScope(req.user) })
    : Request.findById(recordId);
  const request = await query.populate(populate);
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
    "priority",
  ]);
  const recordId = v.id(req.params.id);
  const request = await (req.user.role === "staff"
    ? Request.findOne({ _id: recordId, ...requestScope(req.user) })
    : Request.findById(recordId));
  if (!request) v.fail("Request not found", 404);
  const values = {};
  if (req.body.priority !== undefined) values.priority = v.choice(req.body.priority, ["Normal", "Urgent"], "priority");
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
  for (const key of Object.keys(values)) {
    if (String(values[key] ?? "") === String(request[key] ?? "")) delete values[key];
  }
  if (!Object.keys(values).length) {
    return res.json({ message: "No changes to save", request, allowedStatuses: transitions[request.status] });
  }
  const { event } = require("../utils/notificationEvent");
  const message = `${request.service || "Your service request"}: ${values.status || request.status}.${values.staffComment ? " Update: " + values.staffComment : ""}${values.assignedStaff !== undefined ? " Your staff assignment changed." : ""}${values.priority ? " Priority: " + values.priority + "." : ""}`;
  const notices = [event(request.student, message, { title: values.status ? `Request ${values.status.toLowerCase()}` : "Service request update" })];
  if (values.assignedStaff && String(values.assignedStaff) !== String(request.assignedStaff || ""))
    notices.push(event(values.assignedStaff, "A service request has been assigned to you.", { title: "New request assignment" }));
  if (values.assignedStaff !== undefined && request.assignedStaff && String(values.assignedStaff || "") !== String(request.assignedStaff))
    notices.push(event(request.assignedStaff, "A service request was reassigned away from you.", { title: "Request reassigned" }));
  if (req.user.role === "admin" && request.assignedStaff && values.assignedStaff === undefined)
    notices.push(event(request.assignedStaff, "An administrator updated your assigned service request."));
  // The condition prevents overwriting a concurrent status update.
  const updated = await Request.findOneAndUpdate(
    { _id: recordId, ...requestScope(req.user), status: request.status, updatedAt: request.updatedAt },
    { $set: values, $push: { notificationEvents: { $each: notices } } },
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
