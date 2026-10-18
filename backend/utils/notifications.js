const Notification = require("../models/Notification");
// Source writes persist events atomically. Inbox reads retry delivery safely.
exports.flush = async (Model, user, adminQueue = false) => {
  const records = await Model.find(adminQueue ? { "notificationEvents.audience": "admin-review" } : {
    "notificationEvents.user": user
  }).select("+notificationEvents");
  for (const record of records) for (const event of record.notificationEvents) {
    if (adminQueue ? event.audience !== "admin-review" : String(event.user) !== user) continue;
    const types = { Request: "request", Appointment: "appointment", Complaint: "complaint", User: "staff-approval" };
    const type = event.type || types[Model.modelName];
    try {
      await Notification.updateOne({
        eventKey: event.key
      }, {
        $setOnInsert: {
          user: adminQueue ? user : event.user,
          message: event.message,
          isRead: false,
          ...(type && { type, title: event.title || ({ request: "Service request update", appointment: "Appointment update", complaint: "Complaint update", "staff-approval": "Staff registration update" }[type] || "University update"), entityType: event.entityType || type, entityId: event.entityId || record._id }),
          ...(event.occurredAt && { createdAt: event.occurredAt }),
        }
      }, {
        upsert: true
      });
    } catch (error) {
      // Concurrent inbox reads can deliver the same event. Its unique key wins.
      if (error.code !== 11000) throw error;
    }
    await Model.updateOne({
      _id: record._id
    }, {
      $pull: {
        notificationEvents: {
          key: event.key
        }
      }
    }, { timestamps: false });
  }
};
// A failed inbox delivery must not turn a successfully saved action into a 500.
// Its persisted source event is retained for the next inbox read.
exports.tryFlush = async (Model, user) => {
  try {
    await exports.flush(Model, user);
  } catch {/* durable retry on inbox read */}
};
