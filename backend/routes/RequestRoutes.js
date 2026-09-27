const express = require("express");

const {
    createRequest,
    getMyRequests
} = require("../controllers/RequestController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createRequest);

router.get("/my", protect, getMyRequests);

module.exports = router;