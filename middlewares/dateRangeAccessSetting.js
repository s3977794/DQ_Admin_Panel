const DateRangeAccessSetting = require("../models/dateRangeAccessModel");
const handleResponse = require("../controllers/utils/handleResponse");

async function checkDateRange(req, res, next) {
  try {
    // Bypass check for Admin or Quản lý
    if (req.user.role === "Admin" || req.user.role === "Quản lý") {
      return next();
    }

    const dateRangeSetting = await DateRangeAccessSetting.findOne();

    if (!dateRangeSetting) {
      return handleResponse(
        req,
        res,
        403,
        "fail",
        "Lỗi truy cập vào giới hạn chỉnh sửa dữ liệu!",
        req.body.currentUrl
      );
    }

    const updateDate = new Date(req.body.date).setUTCHours(0, 0, 0, 0);
    let endDate = new Date(dateRangeSetting.endDate).setUTCHours(
      23,
      59,
      59,
      999
    );
    if (updateDate < dateRangeSetting.startDate || updateDate > endDate) {
      return handleResponse(
        req,
        res,
        403,
        "fail",
        "Truy cập vào dữ liệu đã bị từ chối",
        req.body.currentUrl
      );
    }

    next();
  } catch (error) {
    console.error("Error checking date range:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = checkDateRange;
