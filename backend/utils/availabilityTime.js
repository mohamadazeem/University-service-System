// Legacy slots without an end retain their original 30 minute window.
const endExpression = { $ifNull: ["$endsAt", { $add: ["$startsAt", 1800000] }] };
const endTime = slot => slot.endsAt || new Date(new Date(slot.startsAt).getTime() + 1800000);
const unexpired = (now = new Date()) => ({ $expr: { $gt: [endExpression, now] } });
const expired = (now = new Date()) => ({ $expr: { $lte: [endExpression, now] } });
const status = (slot, now = new Date()) => {
  if (slot.status === "Cancelled") return "Cancelled";
  if (slot.active === false || slot.status === "Closed") return "Closed";
  if (new Date(endTime(slot)) <= now) return "Expired";
  return slot.status || "Published";
};
module.exports = { endTime, unexpired, expired, status };
