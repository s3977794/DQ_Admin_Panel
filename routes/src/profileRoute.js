const express = require("express");
const connectEnsureLogin =  require('connect-ensure-login');
const router = express.Router();
const profileController = require('../../controllers/profileController')

router.get("/",connectEnsureLogin.ensureLoggedIn({redirectTo:'/dang-nhap'}), profileController.renderPage )

router.post('/update/:id', profileController.updateData )

module.exports = router;