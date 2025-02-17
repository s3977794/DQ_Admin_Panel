const express = require("express");
const router = express.Router();
const rawMaterialController = require("../../controllers/rawMaterialController");
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
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", 'superAdmin']),
  rawMaterialController.renderPage
);
router.post(
  "/",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", 'superAdmin']),
  checkPermission("add"),
  rawMaterialController.createData
);
router.post(
  "/getDatas",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", 'superAdmin']),
  rawMaterialController.getDatas
);
router.put(
  "/:id",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", 'superAdmin']),
  checkPermission("update"),
  rawMaterialController.updateData
);
router.delete(
  "/:id",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", 'superAdmin']),
  checkPermission("delete"),
  rawMaterialController.deleteData
);
router.post(
  "/deleteAll",
  authMiddlewares.ensureRoles(["Admin", "Văn phòng", 'superAdmin']),
  checkPermission("delete"),
  rawMaterialController.deleteAll
);

module.exports = router;
