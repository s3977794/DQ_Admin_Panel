const express = require("express");
const router = express.Router();
const dateRangeController = require("../../controllers/dateRangeAccessController");
const authMiddlewares = require("../../middlewares/authMiddlewares");

router.post(
  "/setDateRange",
  authMiddlewares.ensureRoles(["Admin", "Quản lý"]),
  dateRangeController.setDateRange
);

module.exports = router;
