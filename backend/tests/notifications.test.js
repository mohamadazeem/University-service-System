const {
  test
} = require("node:test");
const assert = require("node:assert/strict");
const Notification = require("../models/Notification");
const {
  flush,
  tryFlush
} = require("../utils/notifications");
const user = "222222222222222222222222";
const event = {
  key: "event-key",
  user,
  message: "Request received"
};
const source = events => {
  const removed = [];
  return {
    removed,
    find: filter => {
      assert.deepEqual(filter, {
        "notificationEvents.user": user
      });
      return {
        select: async projection => {
          assert.equal(projection, "+notificationEvents");
          return [{
            _id: "source-record",
            notificationEvents: events
          }];
        }
      };
    },
    updateOne: async (filter, update) => removed.push({
      filter,
      update
    })
  };
};
test("notification delivery uses an idempotent event key before removing its source event", async t => {
  const Model = source([event, {
    ...event,
    user: "another-user"
  }]);
  let writes = 0;
  t.mock.method(Notification, "updateOne", async (filter, update, options) => {
    writes++;
    assert.deepEqual(filter, {
      eventKey: event.key
    });
    assert.deepEqual(update, {
      $setOnInsert: {
        user,
        message: event.message,
        isRead: false
      }
    });
    assert.deepEqual(options, {
      upsert: true
    });
  });
  await flush(Model, user);
  assert.equal(writes, 1);
  assert.deepEqual(Model.removed, [{
    filter: {
      _id: "source-record"
    },
    update: {
      $pull: {
        notificationEvents: {
          key: event.key
        }
      }
    }
  }]);
});
test("delivery failure preserves the source event for a later inbox retry", async t => {
  const Model = source([event]);
  t.mock.method(Notification, "updateOne", async () => {
    throw new Error("Database unavailable");
  });
  await assert.rejects(flush(Model, user), /Database unavailable/);
  await tryFlush(Model, user);
  assert.equal(Model.removed.length, 0);
});
test("concurrent duplicate delivery acknowledges the existing unique notification", async t => {
  const Model = source([event]);
  t.mock.method(Notification, "updateOne", async () => {
    throw Object.assign(new Error("Duplicate"), {
      code: 11000
    });
  });
  await flush(Model, user);
  assert.equal(Model.removed.length, 1);
});
