const router = require("express").Router();
router.get("/", require("../controllers/serviceController").publicServices);
module.exports = router;
