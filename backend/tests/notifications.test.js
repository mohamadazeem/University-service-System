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
    updateOne: async (filter, update, options) => {
      assert.deepEqual(options, { timestamps: false });
      removed.push({ filter, update });
    }
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

test("delivery preserves category, entity, title and occurrence time", async t => {
  const occurredAt = new Date("2026-10-18T00:00:00Z");
  const Model = { ...source([{ ...event, type: "request", title: "Assigned request", occurredAt }]), modelName: "Request" };
  t.mock.method(Notification, "updateOne", async (_filter, update) => {
    assert.equal(update.$setOnInsert.type, "request");
    assert.equal(update.$setOnInsert.title, "Assigned request");
    assert.equal(update.$setOnInsert.entityId, "source-record");
    assert.equal(update.$setOnInsert.createdAt, occurredAt);
  });
  await flush(Model, user);
});

test("admin review queue reaches only the designated active administrator", async t => {
  const User = require("../models/user");
  const Models = [require("../models/Request"), require("../models/Appointment"), require("../models/Complaint"), User];
  const owner = "111111111111111111111111";
  t.mock.method(User, "findOne", filter => {
    assert.deepEqual(filter, { role: "admin", active: { $ne: false } });
    return { sort: sort => { assert.deepEqual(sort, { _id: 1 }); return { select: async () => ({ _id: owner }) }; } };
  });
  const queueReads = [];
  for (const Model of Models) t.mock.method(Model, "find", filter => {
    if (filter["notificationEvents.audience"]) queueReads.push(Model.modelName);
    return { select: async () => filter["notificationEvents.audience"] && Model === User ? [{ _id: "registration", notificationEvents: [{ key: "admin-event", audience: "admin-review", message: "Approval needed" }] }] : [] };
  });
  t.mock.method(User, "updateOne", async () => {});
  t.mock.method(Notification, "countDocuments", async filter => { assert.ok([user, owner].includes(filter.user)); return 1; });
  let recipient;
  t.mock.method(Notification, "updateOne", async (_filter, update) => { recipient = update.$setOnInsert.user; });
  const count = require("../controllers/notificationController").count;
  await count({ user: { id: user, role: "admin" } }, { json: () => {} });
  assert.equal(queueReads.length, 0);
  await count({ user: { id: owner, role: "admin" } }, { json: () => {} });
  assert.equal(queueReads.length, 4);
  assert.equal(recipient, owner);
});
