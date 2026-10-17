// Assignment is an authorization boundary, independent of search filters or departments.
module.exports = (user) => user.role === "staff" ? { assignedStaff: user.id } : {};
