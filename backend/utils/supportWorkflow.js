const appointments = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["In Progress", "Completed", "Rejected", "Cancelled"],
  "In Progress": ["Completed", "Cancelled"],
  Rejected: [], Completed: [], Cancelled: [],
};
const complaints = {
  Pending: ["In Review", "In Progress", "Resolved", "Rejected"],
  "In Review": ["In Progress", "Resolved", "Rejected"],
  "In Progress": ["Resolved", "Rejected"],
  Resolved: [], Rejected: [],
};
const priorities = ["Low", "Medium", "High", "Urgent"];
const categories = ["General", "Academic", "Facilities", "Student Services", "Safety", "Other"];
module.exports = { appointments, complaints, priorities, categories };
