const User = require("../models/user");
const Request = require("../models/Request");
const Service = require("../models/service");
const { statuses } = require("../utils/requestStatus");
module.exports = async (req, res) => {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - 5);
  const [students, staff, services, distribution, recentRequests, trends] =
    await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "staff" }),
      Service.countDocuments({ active: { $ne: false } }),
      Request.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Request.find()
        .populate("student", "name email")
        .sort({ createdAt: -1 })
        .limit(5),
      Request.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m",
                date: "$createdAt",
                timezone: "UTC",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
  const statusCounts = Object.fromEntries(
    statuses.map((status) => [
      status,
      distribution.find((row) => row._id === status)?.count || 0,
    ]),
  );
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setUTCMonth(start.getUTCMonth() + index);
    const month = date.toISOString().slice(0, 7);
    return {
      month,
      count: trends.find((row) => row._id === month)?.count || 0,
    };
  });
  res.json({
    students,
    staff,
    services,
    totalRequests: distribution.reduce((sum, row) => sum + row.count, 0),
    statusCounts,
    trends: monthly,
    recentRequests,
  });
};
