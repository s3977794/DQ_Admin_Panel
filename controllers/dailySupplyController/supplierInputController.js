const mongoose = require('mongoose');
const { Supplier, DailySupply } = require('../../models/dailySupplyModel');
const handleResponse = require('../utils/handleResponse');
const convertToDecimal = require('../utils/convertToDecimal');
const trimStringFields = require('../utils/trimStringFields');

module.exports = {
  // User side for input data
  renderInputDataDashboardPage,
  renderInputDataPage,
  addData,
  updateSupplierData,
  deleteSupplierData,
};

async function renderInputDataDashboardPage(req, res) {
  try {
    const { startDate, endDate } = req.query;

    let areas;

    if (req.user.role === 'Admin') {
      // Fetch all areas if the user is an Admin
      areas = await DailySupply.find()
        .populate('suppliers')
        .populate('data.supplier');
    } else {
      // Fetch only the areas assigned to the user by accountID
      const area = await DailySupply.findOne({
        accountID: req.user._id,
      })
        .populate('suppliers')
        .populate('data.supplier');

      // Ensure areas is an array
      areas = area ? [area] : [];
    }

    res.render('src/dailySupplyInputDashboardPage', {
      layout: './layouts/defaultLayout',
      title: `Nguyên liệu hằng ngày`,
      areas,
      user: req.user,
      startDate,
      endDate,
      messages: req.flash(),
    });
  } catch (error) {
    console.error('Error adding suppliers:', error);
    res.status(500).render('partials/500', { layout: false });
  }
}

async function renderInputDataPage(req, res) {
  try {
    const { startDate, endDate } = req.query;
    // Check if the user has the 'Admin' role
    const isAdmin = req.user.role === 'Admin';

    // Find the DailySupply document based on the slug and accountID
    const area = await DailySupply.findOne({
      slug: req.params.slug,
      ...(isAdmin ? {} : { accountID: req.user._id }), // If not admin, add accountID to the query
    })
      .populate('suppliers')
      .populate('data.supplier');

    if (!area) {
      return res.status(404).render('partials/404', { layout: false });
    }

    // Get today's start and end dates
    const startOfToday = new Date();
    startOfToday.setUTCHours(startOfToday.getUTCHours() + 7);
    const endOfToday = new Date();
    endOfToday.setUTCHours(endOfToday.getUTCHours() + 7);

    // Count the number of entries for today
    const todayEntriesCount = await DailySupply.aggregate([
      { $match: { _id: area._id } },
      { $unwind: '$data' },
      { $match: { 'data.date': { $gte: startOfToday, $lte: endOfToday } } },
      { $count: 'count' },
    ]);

    const limitReached =
      todayEntriesCount.length > 0
        ? todayEntriesCount[0].count >= area.limitData
        : false;

    res.render('src/dailySupplyInputPage', {
      layout: './layouts/defaultLayout',
      title: `Nguyên liệu hằng ngày ${area.name}`,
      area,
      user: req.user,
      startDate,
      endDate,
      messages: req.flash(),
      limitReached,
    });
  } catch (error) {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function addData(req, res) {
  try {
    // Trim request body strings
    req.body = trimStringFields(req.body);

    // Get today's date at midnight
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find the DailySupply entry by ID
    const dailySupply = await DailySupply.findById(req.params.id);
    if (!dailySupply) {
      return handleResponse(req, res, 404, 'fail', 'Không tìm thấy DailySupply!', req.headers.referer);
    }

    // Check the number of entries for today
    const todayEntries = dailySupply.data.filter(
      entry => new Date(entry.date).toDateString() === today.toDateString()
    );
    if (todayEntries.length >= dailySupply.limitData) {
      return handleResponse(req, res, 400, 'fail', 'Đã đạt giới hạn dữ liệu hàng ngày!', req.headers.referer);
    }

    // Find the existing supplier by name
    const existedSupplier = await Supplier.findOne({ name: req.body.supplier });
    if (!existedSupplier) {
      return handleResponse(req, res, 400, 'fail', 'Nhà vườn không tồn tại!', req.headers.referer);
    }

    // Prepare raw material entries
    const rawMaterials = req.body.name.map((name, index) => ({
      name,
      percentage: name === 'Mủ nước' ? convertToDecimal(req.body.percentage[index]) : 0,
      ratioSplit: existedSupplier.ratioRubberSplit,
      quantity: convertToDecimal(req.body.quantity[index] || 0),
      price: 0
    }));

    // Create debt and retained money entries
    const debt = {
      date: today,
      debtPaidAmount: 0,
    };

    const moneyRetained = {
      date: today,
      retainedAmount: 0,
      percentage: existedSupplier.moneyRetainedPercentage,
    };

    // Create input data for DailySupply
    const inputedData = {
      date: today,
      rawMaterial: rawMaterials,
      supplier: existedSupplier._id,
      note: trimStringFields(req.body.note) || '',
      debt: debt,  
      moneyRetained: moneyRetained  
    };

    // Save the new data to DailySupply
    const newData = await DailySupply.findByIdAndUpdate(
      req.params.id,
      { $push: { data: inputedData } },
      { new: true, upsert: true }
    );

    if (!newData) {
      return handleResponse(req, res, 404, 'fail', 'Thêm dữ liệu thất bại!', req.headers.referer);
    }

    // Update the referenceData
    const lastDataIndex = newData.data.length - 1;
    const lastDataId = newData.data[lastDataIndex]._id;

    existedSupplier.moneyRetainedHistory.push(lastDataId);
    existedSupplier.debtHistory.push(lastDataId);
    
    await existedSupplier.save();

    // Success response
    return handleResponse(req, res, 200, 'success', 'Thêm dữ liệu thành công!', req.headers.referer);

  } catch (error) {
    console.error('Error adding suppliers:', error);
    res.status(500).render('partials/500', { layout: false });
  }
}


async function updateSupplierData(req, res) {
  try {
    const { id } = req.params;
    req.body = trimStringFields(req.body);
    const {
      date,
      supplier,
      muNuocQuantity,
      muNuocPercentage,
      muNuocRatioSplit,
      muTapQuantity,
      muTapRatioSplit,
      muKeQuantity,
      muKeRatioSplit,
      muDongQuantity,
      muDongRatioSplit,
      muNuocPrice,
      muTapPrice,
      muKePrice,
      muDongPrice,
      note,
    } = req.body;

    let supplierDoc;

    if (supplier) {
      supplierDoc = await Supplier.findOne({ supplierSlug: supplier });
      if (!supplierDoc) {
        return handleResponse(
          req,
          res,
          400,
          'fail',
          'Nhà vườn không tồn tại!',
          req.headers.referer,
        );
      }
    }

    const dailySupply = await DailySupply.findOne({ 'data._id': id });
    if (!dailySupply) {
      return handleResponse(req, res, 404, 'fail', 'Không tìm thấy dữ liệu!', req.headers.referer);
    }

    const dataIndex = dailySupply.data.findIndex(item => item._id.toString() === id);
    if (dataIndex === -1) {
      return handleResponse(req, res, 404, 'fail', 'Không tìm thấy dữ liệu!', req.headers.referer);
    }

    const updatedRawMaterial = dailySupply.data[dataIndex].rawMaterial.map(item => {
      const updatedItem = { ...item };
      if (item.name === 'Mủ nước') {
        updatedItem.quantity = convertToDecimal(muNuocQuantity);
        updatedItem.percentage = convertToDecimal(muNuocPercentage);
        updatedItem.ratioSplit = convertToDecimal(muNuocRatioSplit);
        updatedItem.price = convertToDecimal(muNuocPrice);
      } else if (item.name === 'Mủ tạp') {
        updatedItem.quantity = convertToDecimal(muTapQuantity);
        updatedItem.ratioSplit = convertToDecimal(muTapRatioSplit);
        updatedItem.price = convertToDecimal(muTapPrice);
      } else if (item.name === 'Mủ ké') {
        updatedItem.quantity = convertToDecimal(muKeQuantity);
        updatedItem.ratioSplit = convertToDecimal(muKeRatioSplit);
        updatedItem.price = convertToDecimal(muKePrice);
      } else if (item.name === 'Mủ đông') {
        updatedItem.quantity = convertToDecimal(muDongQuantity);
        updatedItem.ratioSplit = convertToDecimal(muDongRatioSplit);
        updatedItem.price = convertToDecimal(muDongPrice);
      }
      return updatedItem;
    });

    dailySupply.data[dataIndex].date = new Date(date);
    dailySupply.data[dataIndex].rawMaterial = updatedRawMaterial;
    dailySupply.data[dataIndex].note = trimStringFields(note) || '';
    if (supplierDoc) {
      dailySupply.data[dataIndex].supplier = supplierDoc._id;
    }

    await dailySupply.save();

    return handleResponse(req, res, 200, 'success', 'Cập nhật dữ liệu thành công!', req.headers.referer);
  } catch (err) {
    console.error('Error updating supplier data:', err);
    res.status(500).render('partials/500', { layout: false });
  }
}

async function deleteSupplierData(req, res) {
  try {
    const { id } = req.params;

    // Find the DailySupply document containing the sub-document to be deleted
    const dailySupply = await DailySupply.findOne({ 'data._id': id });
    if (!dailySupply) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy dữ liệu!',
        req.headers.referer,
      );
    }

    // Extract the sub-document to be deleted
    const subDocument = dailySupply.data.id(id);
    if (!subDocument) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy dữ liệu!',
        req.headers.referer,
      );
    }

    const supplierId = subDocument.supplier;

    // Remove the sub-document from the DailySupply document
    const updatedData = await DailySupply.findOneAndUpdate(
      { 'data._id': id },
      {
        $pull: { data: { _id: id } },
      },
      { new: true },
    );

    if (!updatedData) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Xóa dữ liệu thất bại!',
        req.headers.referer,
      );
    }

    // Update the supplier's debtHistory and moneyRetainedHistory
    const updateSupplierData = await Supplier.findByIdAndUpdate(
      supplierId,
      {
        $pull: {
          debtHistory: id,
          moneyRetainedHistory: id,
        },
      },
      { new: true }
    );

    if (!updateSupplierData) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Xóa dữ liệu cho nhà vườn thất bại!',
        req.headers.referer,
      );
    }

    return handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa dữ liệu thành công!',
      req.headers.referer,
    );
  } catch (err) {
    console.error('Error deleting supplier data:', err);
    res.status(500).render('partials/500', { layout: false });
  }
}