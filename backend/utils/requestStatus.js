const statuses = ["Pending", "Processing", "Approved", "Rejected", "Completed"];
const transitions = {
  Pending: ["Processing", "Approved", "Rejected"],
  Processing: ["Approved", "Rejected", "Completed"],
  Approved: ["Processing", "Completed"],
  Rejected: [],
  Completed: [],
};
module.exports = { statuses, transitions };
