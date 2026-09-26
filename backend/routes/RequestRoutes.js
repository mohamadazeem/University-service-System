const express = require("express");

const {
    createRequest
} = require("../controllers/requestController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();


router.post(
    "/",
    protect,
    createRequest
);


module.exports = router;