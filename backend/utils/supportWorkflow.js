const appointments = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["Completed", "Rejected", "Cancelled"],
  Rejected: [], Completed: [], Cancelled: [],
};
const complaints = {
  Pending: ["In Review", "Resolved", "Rejected"],
  "In Review": ["Resolved", "Rejected"],
  Resolved: [], Rejected: [],
};
const priorities = ["Low", "Medium", "High", "Urgent"];
const categories = ["General", "Academic", "Facilities", "Student Services", "Safety", "Other"];
module.exports = { appointments, complaints, priorities, categories };
