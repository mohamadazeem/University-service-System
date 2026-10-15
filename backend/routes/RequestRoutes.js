const router = require("express").Router();
const {
  createRequest,
  getMyRequests,
} = require("../controllers/RequestController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
router.use(protect);
router.post("/", authorize("student"), createRequest);
router.get("/my", authorize("student"), getMyRequests);
module.exports = router;
