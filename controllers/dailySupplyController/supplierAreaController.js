const AccountModel = require('../../models/accountModel');
const { Debt, MoneyRetained, Supplier, DailySupply } = require('../../models/dailySupplyModel');

const trimStringFields = require('../utils/trimStringFields');
const handleResponse = require('../utils/handleResponse');
const createSuppliers = require('./helper/createSuppliers');
const convertToDecimal = require('../utils/convertToDecimal');

module.exports = {
  renderPage,
  addArea,
  deleteArea,
};

const ensureArray = input => (Array.isArray(input) ? input : [input]);

async function renderPage(req, res) {
  try {
    const areas = await DailySupply.find({}).populate('accountID');

    const hamLuongAccounts = await AccountModel.find({ role: 'Hàm lượng' });
    const assignedAccounts = await DailySupply.distinct('accountID');
    const unassignedHamLuongAccounts = hamLuongAccounts.filter(
      account =>
        !assignedAccounts
          .map(id => id.toString())
          .includes(account._id.toString()),
    );

    res.render('src/dailySupplyPage', {
      layout: './layouts/defaultLayout',
      title: 'Dữ liệu mủ hằng ngày',
      unassignedHamLuongAccounts,
      areas,
      user: req.user,
      messages: req.flash(),
    });
  } catch (err) {
    console.log(err);
    res.status(500).render('partials/500', { layout: false });
  }
}

async function addArea(req, res) {
  req.body = trimStringFields(req.body);
  try {
    const existingArea = await DailySupply.findOne({ name: req.body.areaName });
    if (existingArea) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Khu vực đã tồn tại!',
        req.headers.referer,
      );
    }

    const areaDimension = parseFloat(req.body.areaDimension) || 0;
    const purchasedAreaDimensions = ensureArray(
      req.body.purchasedAreaDimension,
    ).map(dim => parseFloat(dim) || 0);

    const totalPurchasedAreaDimension = purchasedAreaDimensions.reduce(
      (sum, dim) => sum + dim,
      0,
    );

    if (totalPurchasedAreaDimension > areaDimension) {
      return handleResponse(
        req,
        res,
        400,
        'fail',
        'Tổng diện tích mua vượt quá diện tích khu vực!',
        req.headers.referer,
      );
    }

    const remainingAreaDimension = areaDimension - totalPurchasedAreaDimension;

    const newArea = await DailySupply.create({
      ...req.body,
      name: req.body.areaName,
      areaDimension: areaDimension,
      remainingAreaDimension: remainingAreaDimension,
      areaPrice: convertToDecimal(req.body.areaPrice),
      suppliers: [],
    });

    if (!newArea) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Tạo khu vực thất bại!',
        req.headers.referer,
      );
    }

    const suppliers = await createSuppliers(req);

    if (suppliers && suppliers.length > 0) {
      const createdSuppliers = await Supplier.create(suppliers);
      const suppliersId = createdSuppliers.map(supplier => supplier._id);
      newArea.suppliers = suppliersId;
      await newArea.save();
    }

    return handleResponse(
      req,
      res,
      201,
      'success',
      'Tạo khu vực thành công',
      req.headers.referer,
    );
  } catch (error) {
    console.log(error);
    res.status(500).render('partials/500', { layout: false });
  }
}

async function deleteArea(req, res) {
  try {
    const area = await DailySupply.findByIdAndDelete(req.params.id);
    if (!area) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Xóa khu vực thất bại!',
        req.headers.referer,
      );
    }

    const supplierIds = [
      ...area.suppliers,
      ...area.data.map(d => d.supplier),
    ];

    // Initialize arrays for debt and money retained IDs
    let debtIds = [];
    let moneyRetainedIds = [];

    // Check if areaPrice and areaDimension are greater than 0
    if (area.areaPrice > 0 && area.areaDimension > 0) {
      debtIds = area.data.map(d => d.debt._id);
      moneyRetainedIds = area.data.map(d => d.moneyRetained._id);
    }

    // Run deletion operations concurrently
    const deletedData = await Promise.all([
      Supplier.deleteMany({ _id: { $in: supplierIds } }),
      debtIds.length > 0 ? Debt.deleteMany({ _id: { $in: debtIds } }) : Promise.resolve(),
      moneyRetainedIds.length > 0 ? MoneyRetained.deleteMany({ _id: { $in: moneyRetainedIds } }) : Promise.resolve(),
    ]);

    if (!deletedData) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Xóa khu vực thất bại!',
        req.headers.referer,
      );
    }

    return handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa khu vực thành công',
      req.headers.referer,
    );
  } catch (error) {
    console.error('Error deleting area:', error);
    res.status(500).render('partials/500', { layout: false });
  }
}
