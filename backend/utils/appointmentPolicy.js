// Approved is the existing application's confirmed appointment status.
const activeStatuses = ["Pending", "Approved", "In Progress"];
const occupiedStatuses = [...activeStatuses, "Completed"];
module.exports = { activeStatuses, occupiedStatuses };
