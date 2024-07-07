const SpendModel = require('../models/spendModel');
const ProductTotalModel = require('../models/productTotalModel');
const formatTotalData = require('./utils/formatTotalData');
const trimStringFields = require('./utils/trimStringFields');
const handleResponse = require('./utils/handleResponse');
const formatNumberForDisplay = require('./utils/formatNumberForDisplay');
const convertToDecimal = require('./utils/convertToDecimal');

module.exports = {
  renderPage,
  createData,
  getData,
};

async function renderPage(req, res) {
  try {
    let totalData = await ProductTotalModel.find();
    const total = formatTotalData(totalData);
    let spends = await SpendModel.find();
    res.render('src/spendPage', {
      layout: './layouts/defaultLayout',
      title: 'Quản lý chi tiêu',
      spends,
      total,
      user: req.user,
      messages: req.flash(),
    });
  } catch (err) {
    console.log(err);
    res.status(500).render('partials/500', { layout: false });
  }
}

async function createData(req, res) {
  req.body = trimStringFields(req.body);
  console.log(req.body);
  try {
    let checkExistedProduct = await SpendModel.findOne({
      date: req.body.date,
      product: {$regex: new RegExp(req.body.product, "i")},
    });
    if (checkExistedProduct) {
      return handleResponse(
        req,
        res,
        400,
        'fail',
        'Sản phẩm đã tồn tại !',
        req.headers.referer,
      );
    }

    let quantity = convertToDecimal(req.body.quantity) || 0;
    let price = convertToDecimal(req.body.price) || 0;

    // Create spend document
    await SpendModel.create({
      ...req.body,
      quantity,
      price,
    });

    let totalPrice = price * quantity;

    // Update product total document
    await ProductTotalModel.findOneAndUpdate(
      {},
      {
        $inc: {
          spend: totalPrice,
          profit: totalPrice,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    // Success response
    return handleResponse(
      req,
      res,
      201,
      'success',
      'Tạo chi tiêu thành công !',
      req.headers.referer,
    );
  } catch (err) {
    console.log(err);
    // Error response
    res.status(500).render('partials/500', { layout: false });
  }
}

async function getData(req, res) {
  try {
    const {
      draw,
      start = 0,
      length = 10,
      search,
      order,
      columns,
      startDate,
      endDate,
    } = req.body;

    const searchValue = search?.value || '';
    const sortColumn = columns?.[order?.[0]?.column]?.data;
    const sortDirection = order?.[0]?.dir === 'asc' ? 1 : -1;

    const searchQuery = searchValue
      ? {
          $or: [
            { product: { $regex: searchValue, $options: 'i' } },
            { notes: { $regex: searchValue, $options: 'i' } },
          ],
        }
      : {};

    let filter = { ...searchQuery };

    if (startDate || endDate) {
      filter.date = {};

      const filterStartDate = new Date(startDate || endDate);
      filterStartDate.setHours(0, 0, 0, 0);
      filter.date.$gte = filterStartDate;

      const filterEndDate = new Date(endDate || startDate);
      filterEndDate.setHours(23, 59, 59, 999);
      filter.date.$lte = filterEndDate;
    }

    // Determine if the sort column is 'date'
    const isSortingByDate = sortColumn === 'date';

    const sortObject = isSortingByDate
      ? { [sortColumn]: sortDirection }
      : { date: -1 };

    const totalRecords = await SpendModel.countDocuments();
    const filteredRecords = await SpendModel.countDocuments(filter);
    const products = await SpendModel.find(filter)
      .sort(sortObject)
      .skip(parseInt(start, 10))
      .limit(parseInt(length, 10));

    const data = products.map((product, index) => ({
      no: parseInt(start, 10) + index + 1,
      date: product.date.toLocaleDateString(),
      product: product.product || '',
      quantity: formatNumberForDisplay(product.quantity) || 0,
      price: formatNumberForDisplay(product.price) || 0,
      total: formatNumberForDisplay(product.price * product.quantity) || 0,
      notes: product.notes || '',
      id: product._id,
    }));

    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data,
    });
  } catch (err) {
    console.log(err);
    res.status(500).render('partials/500', { layout: false });
  }
}
