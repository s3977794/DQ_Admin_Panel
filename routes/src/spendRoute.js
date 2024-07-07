const express = require("express");
const router = express.Router();
const spendController = require('../../controllers/spendController')
const connectEnsureLogin =  require('connect-ensure-login');

router.get("/",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), spendController.renderPage )
router.post("/addData",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), spendController.createData )
router.post("/getData",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), spendController.getData )
// router.post("/update/:id",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), spendController.updateProduct )
// router.post("/delete/:id",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), spendController.deleteProduct )
// router.post("/deleteAll",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), spendController.deleteAllProducts )

module.exports = router;