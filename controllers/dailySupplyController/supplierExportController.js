const { Supplier, DailySupply } = require('../../models/dailySupplyModel');

const trimStringFields = require('../utils/trimStringFields');
const handleResponse = require('../utils/handleResponse');
const convertToDecimal = require('../utils/convertToDecimal');
const updatePricesAndRatiosHelper = require('../utils/updatePricesAndRatiosHelper');

module.exports = {
  renderPage,
  updatePricesAndRatios,
};
async function renderPage(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const area = await DailySupply.findOne({ slug: req.params.slug })
      .populate('accountID')
      .populate('suppliers')
      .populate('data.supplier');

    res.render('src/dailySupplyExportPage', {
      layout: './layouts/defaultLayout',
      title: `Xuất dữ liệu mủ của ${area.name}`,
      area,
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

async function updatePricesAndRatios(req, res) {
  req.body = trimStringFields(req.body);
  try {
    const {
      startDate,
      endDate,
      dryPrice,
      mixedPrice,
      kePrice,
      dongPrice,
      drySplit,
      mixedSplit,
      keSplit,
      dongSplit,
    } = req.body; 
    const { slug, supplierSlug } = req.params;

    const area = await DailySupply.findOne({ slug })
      .populate('accountID')
      .populate('suppliers')
      .populate('data.supplier');

    if (!area) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy khu vực cung cấp',
        req.headers.referer,
      );
    }

    const start = new Date(startDate || endDate || new Date());
    const end = new Date(endDate || startDate || new Date());
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const prices = {
      dryPrice: convertToDecimal(dryPrice),
      mixedPrice: convertToDecimal(mixedPrice),
      kePrice: convertToDecimal(kePrice),
      dongPrice: convertToDecimal(dongPrice),
    };

    const ratios = {
      'Mủ nước': convertToDecimal(drySplit),
      'Mủ tạp': convertToDecimal(mixedSplit),
      'Mủ ké': convertToDecimal(keSplit),
      'Mủ đông': convertToDecimal(dongSplit),
    };

    let supplierId = null;
    if (supplierSlug) {
      const supplier = await Supplier.findOne({ supplierSlug });
      if (!supplier) {
        return handleResponse(
          req,
          res,
          404,
          'fail',
          'Không tìm thấy nhà cung cấp',
          req.headers.referer,
        );
      }
      supplierId = supplier._id;
    }

    updatePricesAndRatiosHelper(
      area.data,
      start,
      end,
      prices,
      ratios,
      supplierId,
    ); // Updated function call
    await area.save();

    const successMessage = supplierSlug
      ? 'Cập nhật giá thành công cho nhà cung cấp'
      : 'Cập nhật giá thành công cho khu vực';
    return handleResponse(
      req,
      res,
      200,
      'success',
      successMessage,
      req.headers.referer,
    );
  } catch (error) {
    console.error('Error updating prices:', error);
    res.status(500).render('partials/500', { layout: false });
  }
}
