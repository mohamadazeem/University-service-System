const router = require("express").Router();
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const scope = require("../middleware/departmentScope");
const requests = require("../controllers/adminRequestController");
const Request = require("../models/Request");
const { statuses } = require("../utils/requestStatus");
router.use(protect, authorize("staff"), scope);
router.get("/dashboard", async (req, res) => {
  const counts = await Promise.all(statuses.map((status) => Request.countDocuments({ ...req.requestScope, status })));
  res.json({ department: req.user.department, total: counts.reduce((a, b) => a + b, 0), counts: Object.fromEntries(statuses.map((status, i) => [status, counts[i]])) });
});
router.get("/requests", requests.listRequests);
router.get("/requests/:id", requests.getRequest);
router.patch("/requests/:id", requests.updateRequest);
module.exports = router;
