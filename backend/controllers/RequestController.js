const Request = require("../models/Request");
const Service = require("../models/service");
const v = require("../utils/validation");
const createRequest = async (req, res) => {
  v.body(req.body, [
    "service",
    "serviceId",
    "studentId",
    "description",
    "priority",
  ]);
  const studentId = v.text(req.body.studentId, "Student ID", 50);
  if (req.user.studentId && studentId !== req.user.studentId)
    v.fail("Use the student ID registered on your account");
  const description = v.text(req.body.description, "Description", 4000);
  const priority =
    req.body.priority === undefined
      ? "Normal"
      : v.choice(req.body.priority, ["Normal", "Urgent"], "priority");
  const filter = req.body.serviceId
    ? { _id: v.id(req.body.serviceId) }
    : { name: v.text(req.body.service, "Service", 120) };
  const service = await Service.findOne({ ...filter, active: { $ne: false } });
  if (!service)
    v.fail("This service is unavailable. Choose an active service.", 404);
  const request = await Request.create({
    notificationEvents: [require("../utils/notificationEvent").event(req.user.id, "Your service request has been submitted."), require("../utils/notificationEvent").adminEvent("A new service request requires assignment.", { title: "Request awaiting assignment" })],
    student: req.user.id,
    service: service.name,
    serviceRef: service._id,
    studentId,
    description,
    priority,
  });
  request.notificationEvents = undefined;
  await require("../utils/notifications").tryFlush(Request, req.user.id);
  res
    .status(201)
    .json({ message: "Service request submitted successfully", request });
};
const getMyRequests = async (req, res) => {
  const requests = await Request.find({ student: req.user.id }).sort({
    createdAt: -1,
  });
  res.json({ requests });
};
module.exports = { createRequest, getMyRequests };
