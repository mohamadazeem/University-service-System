const Notification = require("../models/Notification");
// Source writes persist events atomically. Inbox reads retry delivery safely.
exports.flush = async (Model, user) => {
  const records = await Model.find({
    "notificationEvents.user": user
  }).select("+notificationEvents");
  for (const record of records) for (const event of record.notificationEvents) {
    if (event.user.toString() !== user) continue;
    try {
      await Notification.updateOne({
        eventKey: event.key
      }, {
        $setOnInsert: {
          user: event.user,
          message: event.message,
          isRead: false
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
    });
  }
};
// A failed inbox delivery must not turn a successfully saved action into a 500.
// Its persisted source event is retained for the next inbox read.
exports.tryFlush = async (Model, user) => {
  try {
    await exports.flush(Model, user);
  } catch {/* durable retry on inbox read */}
};
