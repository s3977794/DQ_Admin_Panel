const express = require("express");
const router = express.Router();
const rawMaterialController = require("../../controllers/rawMaterialController");
const authMiddlewares = require("../../middlewares/authMiddlewares");
const checkPermission = require("../../middlewares/checkPermission");

// Apply ensureLoggedIn middleware to all routes
router.use(authMiddlewares.ensureLoggedIn);
router.use(authMiddlewares.ensureWorkingHours);

router.get(
  "/",

  authMiddlewares.ensureRoles(["Admin"]),
  rawMaterialController.renderPage
);
router.post(
  "/",
  authMiddlewares.ensureRoles(["Admin"]),
  checkPermission("add"),
  rawMaterialController.createData
);
router.post(
  "/getDatas",
  authMiddlewares.ensureRoles(["Admin"]),
  rawMaterialController.getDatas
);
router.put(
  "/:id",
  authMiddlewares.ensureRoles(["Admin"]),
  checkPermission("update"),
  rawMaterialController.updateData
);
router.delete(
  "/:id",
  authMiddlewares.ensureRoles(["Admin"]),
  checkPermission("delete"),
  rawMaterialController.deleteData
);
router.delete(
  "/deleteAll",
  authMiddlewares.ensureRoles(["Admin"]),
  checkPermission("delete"),
  rawMaterialController.deleteAll
);

module.exports = router;
