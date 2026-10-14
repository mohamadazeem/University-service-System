const router = require("express").Router();
const { registerUser, loginUser } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const limiter = require("../middleware/loginLimiter");
router.post("/register", limiter, registerUser);
router.post("/login", limiter, loginUser);
router.get("/me", protect, (req, res) => res.json({ user: req.user }));
module.exports = router;
