const UserModel = require("../models/accountModel");
const bcrypt = require("bcryptjs");
const handleResponse = require("./utils/handleResponse");
const trimStringFields = require("./utils/trimStringFields");
const { DailySupply } = require("../models/dailySupplyModel");

module.exports = {
  initialSetupPage,
  initialSetupCreateAccount,
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  logOut,
  renderPage,
  deleteAllUsers,
};

async function isDatabaseEmpty() {
  const userCount = await UserModel.countDocuments();
  return userCount === 0;
}

async function initialSetupPage(req, res) {
  try {
    if (await isDatabaseEmpty()) {
      res.render("src/signUpPage", { layout: false, messages: req.flash() });
    } else {
      res.status(404).redirect("/dang-nhap");
    }
  } catch (error) {
    res.status(404).render("partials/404", { layout: false });
  }
}

async function initialSetupCreateAccount(req, res) {
  try {
    if (await isDatabaseEmpty()) {
      await createUser(req, res);
    } else {
      res.status(404).redirect("/dang-nhap");
    }
  } catch (error) {
    res.status(500).render("partials/500", { layout: false });
  }
}

async function renderPage(req, res) {
  try {
    const users = await UserModel.find();
    res.render("src/accountPage", {
      layout: "./layouts/defaultLayout",
      users,
      user: req.user,
      messages: req.flash(),
      title: "Quản lý tài khoản",
    });
  } catch {
    res.status(500).render("partials/500", { layout: false });
  }
}

async function createUser(req, res) {
  req.body = trimStringFields(req.body);
  try {
    let existedUsername = await UserModel.findOne({
      username: req.body.username,
    });
    if (existedUsername) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Tên tài khoản đã tồn tại. Hãy tạo với tên khác!",
        req.headers.referer
      );
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = await UserModel.create({
      username: req.body.username,
      password: hashedPassword,
      role: req.body.role || 'Admin',
      permissions: {
        add: req.body.addPermission,
        update: req.body.updatePermission,
        delete: req.body.deletePermission,
      },
    });
    if (!user) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Tạo tài khoản thất bại",
        req.headers.referer
      );
    }

    handleResponse(
      req,
      res,
      201,
      "success",
      "Tạo tài khoản thành công",
      req.user ? req.headers.referer : "/dang-nhap"
    );
  } catch {
    res.status(500).render("partials/500", { layout: false });
  }
}

async function getUsers(req, res) {
  try {
    const { draw, start = 0, length = 10, search, order, columns } = req.body;
    const searchValue = search?.value || "";
    const sortColumn = columns?.[order?.[0]?.column]?.data;
    const sortDirection = order?.[0]?.dir === "asc" ? 1 : -1;

    const searchQuery = {
      $or: [
        { username: { $regex: searchValue, $options: "i" } },
        { role: { $regex: searchValue, $options: "i" } },
      ],
    };

    const totalRecords = await UserModel.countDocuments();
    const filteredRecords = await UserModel.countDocuments(searchQuery);
    const users = await UserModel.find(searchQuery)
      .sort({ role: 1, [sortColumn]: sortDirection })
      .skip(parseInt(start, 10))
      .limit(parseInt(length, 10));

    const data = users.map((user, index) => ({
      no: parseInt(start, 10) + index + 1,
      username: user.username,
      password: "**********",
      role: user.role,
      permissions: user.permissions,
      id: user._id,
    }));

    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data,
    });
  } catch {
    res.status(500).render("partials/500", { layout: false });
  }
}

async function updateUser(req, res) {
  req.body = trimStringFields(req.body);
  try {
    const userID = req.params.id;
    console.log(req.body);
    if (!userID) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Không thấy tài khoản",
        req.headers.referer
      );
    }
    const user = await UserModel.findById(userID);

    if (
      req.body.oldPassword &&
      !(await bcrypt.compare(req.body.oldPassword, user.password))
    ) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Mật khẩu cũ không đúng",
        req.headers.referer
      );
    }

    const updateFields = {
      username: req.body.username,
      role: req.body.role,
      permissions: {
        add: req.body.addPermission,
        update: req.body.updatePermission,
        delete: req.body.deletePermission,
      },
    };

    let passwordChanged = false;
    if (req.body.newPassword) {
      updateFields.password = await bcrypt.hash(req.body.newPassword, 10);
      passwordChanged = true;
    }

    const newUser = await UserModel.findByIdAndUpdate(userID, updateFields, {
      new: true,
    });

    if (!newUser) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Cập nhập tài khoản thất bại",
        req.headers.referer
      );
    }

    // If the password was changed and the user being updated is the logged-in user, regenerate the session
    if (passwordChanged && req.user._id.toString() === userID) {
      req.session.regenerate(function (err) {
        if (err) {
          return res.status(500).render("partials/500", { layout: false });
        }

        // Save the session after modifications
        req.session.save(function (saveErr) {
          if (saveErr) {
            return res.status(500).render("partials/500", { layout: false });
          }

          // Send success response after session is saved
          return handleResponse(
            req,
            res,
            200,
            "success",
            "Cập nhập tài khoản thành công",
            req.headers.referer
          );
        });
      });
    } else {
      // Send success response if password was not changed or user being updated is not the logged-in user
      return handleResponse(
        req,
        res,
        200,
        "success",
        "Cập nhập tài khoản thành công",
        req.headers.referer
      );
    }
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).render("partials/500", { layout: false });
  }
}

async function deleteUser(req, res) {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Không thấy tài khoản",
        req.headers.referer
      );
    }
    if (user.role === "Admin") {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Không thể xóa tài khoản quản trị",
        req.headers.referer
      );
    }

    // Proceed to delete the user from the database
    await UserModel.findByIdAndDelete(req.params.id);
    // Remove the accountID from the DailySupply collection
    await DailySupply.updateMany(
      { accountID: req.params.id },
      { $unset: { accountID: "" } }
    );

    return handleResponse(
      req,
      res,
      200,
      "success",
      "Xóa tài khoản thành công",
      req.headers.referer
    );
  } catch {
    res.status(500).render("partials/500", { layout: false });
  }
}

async function deleteAllUsers(req, res) {
  try {
    // Find all users with role not equal to 'Admin'
    const usersToDelete = await UserModel.find({ role: { $ne: "Admin" } });

    if (usersToDelete.length === 0) {
      return handleResponse(
        req,
        res,
        404,
        "fail",
        "Không có tài khoản nào để xóa",
        req.headers.referer
      );
    }

    // Extract user IDs
    const userIds = usersToDelete.map((user) => user._id);

    // Delete all users with role not equal to 'Admin'
    await UserModel.deleteMany({ _id: { $in: userIds } });

    // Remove the accountID from the DailySupply collection
    await DailySupply.updateMany(
      { accountID: { $in: userIds } },
      { $unset: { accountID: "" } }
    );

    return handleResponse(
      req,
      res,
      200,
      "success",
      "Xóa tất cả tài khoản nhân viên thành công",
      req.headers.referer
    );
  } catch (error) {
    console.error(error);
    res.status(500).render("partials/500", { layout: false });
  }
}

function logOut(req, res, next) {
  // Destroy the session
  req.session.destroy(function (err) {
    if (err) {
      return next(err);
    }

    // Clear specific cookies if needed
    res.clearCookie("dpixport", {
      path: "/",
      secure: true,
    });

    // Redirect to the login page or wherever appropriate
    res.redirect("/dang-nhap");
  });
}
