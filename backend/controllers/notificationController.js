const Notification = require("../models/Notification");
const User = require("../models/user");
const v = require("../utils/validation");
const { tryFlush } = require("../utils/notifications");
const sources = () => [require("../models/Request"), require("../models/Appointment"), require("../models/Complaint"), User];
const fields = "title message type entityType entityId isRead readAt createdAt";
const types = ["request", "appointment", "complaint", "staff-approval", "general"];
async function deliver(user) {
  let queueOwner = false;
  if (user.role === "admin") {
    const owner = await User.findOne({ role: "admin", active: { $ne: false } }).sort({ _id: 1 }).select("_id");
    queueOwner = String(owner?._id) === user.id;
  }
  for (const Model of sources()) {
    await tryFlush(Model, user.id);
    if (queueOwner) {
      try { await require("../utils/notifications").flush(Model, user.id, true); }
      catch { /* Keep source events for a later poll without hiding the inbox. */ }
    }
  }
}
exports.list = async (req, res) => {
  const p = v.paging(req.query, ["createdAt"]);
  const filter = { user: req.user.id };
  if (req.query.read) filter.isRead = v.choice(req.query.read, ["read", "unread"], "read filter") === "read";
  if (req.query.type) {
    const type = v.choice(req.query.type, types, "notification type");
    filter.type = type === "general" ? { $in: ["general", null] } : type;
  }
  await deliver(req.user);
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).select(fields).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user.id, isRead: false }),
  ]);
  res.json({ items, total, unread, page: p.page, pages: Math.ceil(total / p.limit), types });
};
exports.count = async (req, res) => {
  await deliver(req.user);
  res.json({ unread: await Notification.countDocuments({ user: req.user.id, isRead: false }) });
};
exports.read = async (req, res) => {
  const item = await Notification.findOneAndUpdate({ _id: v.id(req.params.id), user: req.user.id },
    { $set: { isRead: true, readAt: new Date() } }, { returnDocument: "after", projection: fields });
  if (!item) v.fail("Notification not found", 404);
  res.json({ item });
};
exports.readAll = async (req, res) => {
  await deliver(req.user);
  await Notification.updateMany({ user: req.user.id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  res.json({ message: "All notifications marked as read." });
};
exports.related = async (req, res) => {
  const notification = await Notification.findOne({ _id: v.id(req.params.id), user: req.user.id });
  if (!notification) v.fail("Notification not found", 404);
  const type = notification.entityType || notification.type;
  const definitions = {
    request: [require("../models/Request"), "service description priority status staffComment createdAt updatedAt"],
    appointment: [require("../models/Appointment"), "date time reason rejectionReason status history slot staff createdAt updatedAt"],
    complaint: [require("../models/Complaint"), "subject description status response category priority department createdAt updatedAt"],
  };
  if (!definitions[type] || !notification.entityId) v.fail("Related record is no longer available", 404);
  const [Model, fields] = definitions[type];
  let query = Model.findOne({ _id: notification.entityId, student: req.user.id }).select(fields);
  if (type === "appointment") query = query.populate("staff", "name").populate("slot", "title serviceName startsAt endsAt location instructions");
  const item = await query;
  if (!item) v.fail("Related record is no longer available", 404);
  res.json({ type, item });
};
