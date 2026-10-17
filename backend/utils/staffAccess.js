const message = (user) => {
  if (user.role !== "staff" || user.approvalStatus === "approved") return "";
  return user.approvalStatus === "rejected"
    ? "Your staff registration was rejected. Please contact the university administrator for review."
    : "Your account is awaiting administrator approval.";
};
module.exports = { message };
