const express = require("express");
const router = express.Router();
const spendController = require("../../controllers/spendController");
const authMiddlewares = require("../../middlewares/authMiddlewares");
const checkPermission = require("../../middlewares/checkPermission");
const setUnreadCount = require("../../middlewares/unreadCountMiddleware");
const checkPageAccess = require("../../middlewares/checkPageAccess");

// Apply ensureLoggedIn middleware to all routes
router.use(authMiddlewares.ensureLoggedIn);
router.use(authMiddlewares.ensureWorkingHours);
router.use(checkPageAccess());

router.get(
  "/",
  setUnreadCount,
  checkPermission("view"),
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", "superAdmin"]),
  spendController.renderPage
);
router.post(
  "/",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", "superAdmin"]),
  checkPermission("add"),
  spendController.createData
);
router.post(
  "/getData",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", "superAdmin"]),
  spendController.getData
);
router.put(
  "/:id",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", "superAdmin"]),
  checkPermission("update"),
  spendController.updateData
);
router.delete(
  "/:id",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", "superAdmin"]),
  checkPermission("delete"),
  spendController.deleteData
);
router.post(
  "/deleteAll",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", "superAdmin"]),
  checkPermission("delete"),
  spendController.deleteAll
);

module.exports = router;
