const ProductModel = require('../models/productModel');
const handleResponse = require('./utils/handleResponse');
const trimStringFields = require('./utils/trimStringFields');
const ProductTotalModel = require('../models/productTotalModel');
const formatTotalData = require('./utils/formatTotalData');
const convertToDecimal = require('./utils/convertToDecimal');

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
  getProducts,
  renderPage,
  deleteAll
};


async function updateTotal(dryRubberAdjustment, productAdjustment) {
  let updateData = {};
  if (dryRubberAdjustment !== 0) {
    updateData.$inc = {
      ...updateData.$inc,
      dryRubber: dryRubberAdjustment,
    };
  }
  if (productAdjustment !== 0) {
    updateData.$inc = {
      ...updateData.$inc,
      product: productAdjustment,
    };
  }

  // Update the totals in the database
  return await ProductTotalModel.findOneAndUpdate({}, updateData, {
    new: true,
  });
}

async function renderPage(req, res) {
  try {
    let totalData = await ProductTotalModel.find();
    const total = formatTotalData(totalData);

    const products = await ProductModel.find({});
    res.render('src/productPage', {
      layout: './layouts/defaultLayout',
      title: 'Quản lý hàng hóa',
      products,
      user: req.user,
      total,
      messages: req.flash(),
    });
  } catch {
    res.status(500).render('partials/500', {layout: false});
  }
}

async function updateProductTotals(dryRubberAdjustment, productAdjustment) {
  let updateData = {};
  if (dryRubberAdjustment !== 0) {
    updateData.$inc = {
      ...updateData.$inc,
      // Convert to number after using toFixed to ensure it's stored as a float
      dryRubber: dryRubberAdjustment,
    };
  }
  if (productAdjustment !== 0) {
    updateData.$inc = {
      ...updateData.$inc,
      // Convert to number after using toFixed to ensure it's stored as a float
      product: productAdjustment,
    };
  }

  const total = await ProductTotalModel.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });

  return total;
}

async function createProduct(req, res) {
  req.body = trimStringFields(req.body);

  try {
    let date = await ProductModel.findOne({ date: req.body.date });
    if (date) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Đã có dữ liệu ngày này. Hãy chọn ngày khác!',
        req.headers.referer,
      );
    }

    
    let quantity = convertToDecimal(req.body.quantity) || 0;
    let dryRubberUsed = convertToDecimal(req.body.dryRubberUsed) || 0;
    let dryPercentage = convertToDecimal(req.body.dryPercentage) || 0;

    await ProductModel.create({
      ...req.body,
      quantity,
      dryRubberUsed,
      dryPercentage
    });


    let totalDryRubber = (dryRubberUsed * dryPercentage) / 100;

    console.log(totalDryRubber)
    // Calculate adjustments
    let dryRubberAdjustment = -totalDryRubber;
    let productAdjustment = quantity;

    await updateProductTotals(
      dryRubberAdjustment,
      productAdjustment,
    );

    handleResponse(
      req,
      res,
      201,
      'success',
      'Thêm hàng hóa thành công',
      req.headers.referer,
    );
  } catch (err) {
    console.log(err);
    res.status(500).render('partials/500', {layout: false});
  }
}

async function updateProduct(req, res) {
  try {
    const date = await ProductModel.findOne({date: req.body.date})
    if (date && date._id.toString() !== id) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Đã có dữ liệu ngày này. Hãy chọn ngày khác!',
        req.headers.referer,
      );
    }
    

    const { id } = req.params;
    // Convert input values to decimals
    const dryRubberUsedInput = convertToDecimal(req.body.dryRubberUsed) || 0 ;
    const quantityInput = convertToDecimal(req.body.quantity) || 0;

    // Prepare the fields to be updated
    const updateFields = {
      date: req.body.date,
      dryRubberUsed: dryRubberUsedInput,
      quantity: quantityInput,
      notes: req.body.notes.trim(),
    };

    // Check if the product exists before attempting to update
    const oldData = await ProductModel.findById(id);
    if (!oldData) {
      return res.status(404).send('Product not found');
    }

    await ProductModel.findByIdAndUpdate(id, updateFields, { new: true });

    const dryRubberUsedDiff = dryRubberUsedInput - oldData.dryRubberUsed;
    const quantityDiff = quantityInput - oldData.quantity;

    console.log(dryRubberUsedDiff)
    console.log(quantityDiff)
    
    // Update totals if there are changes in dryRubberUsed or quantity
    if (dryRubberUsedDiff !== 0 || quantityDiff !== 0) {
      const total = await updateTotal(-dryRubberUsedDiff, quantityDiff);
      if (!total) {
        return handleResponse(
          req,
          res,
          404,
          'fail',
          'Cập nhật dữ liệu tổng thất bại',
          req.headers.referer,
        );
      }
    }

    // Respond with success message
    return handleResponse(
      req,
      res,
      200,
      'success',
      'Cập nhật hàng hóa thành công',
      req.headers.referer,
    );
  } catch (error) {
    // Handle any errors that occur during the update process
    res.status(500).render('partials/500', {layout: false});
  }
}



async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy hàng hóa trong cơ sở dữ liệu',
        req.headers.referer,
      );
    }

    const deletedProduct = await ProductModel.findByIdAndDelete(id);

    if (!deletedProduct) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Xóa hàng hóa thất bại',
        req.headers.referer,
      );
    }

    let dryRubberAdjustment = deletedProduct.dryRubberUsed;
    let productAdjustment = -deletedProduct.quantity;

    // Update totals
    const total = await updateProductTotals(
      dryRubberAdjustment,
      productAdjustment,
    );
    if (!total) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Cập nhật dữ liệu tổng thất bại',
        req.headers.referer,
      );
    }

    handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa hàng hóa thành công',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', {layout: false});
  }
}

async function deleteAllProducts(req, res) {
  try {
    await ProductModel.deleteMany({});
    return handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa tất cả hàng hóa thành công',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', {layout: false});
  }
}

async function getProducts(req, res) {
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

    const totalRecords = await ProductModel.countDocuments();
    const filteredRecords = await ProductModel.countDocuments(filter);
    const products = await ProductModel.find(filter)
      .sort(sortObject)
      .skip(parseInt(start, 10))
      .limit(parseInt(length, 10));

    const data = products.map((product, index) => ({
      no: parseInt(start, 10) + index + 1,
      date: product.date.toLocaleDateString('vi-VN'),
      dryRubberUsed: ((product.dryRubberUsed * product.dryPercentage) / 100).toLocaleString('vi-VN'),
      quantity: product.quantity.toLocaleString('vi-VN') || 0,
      notes: product.notes || '',
      id: product._id,
    }));

    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data,
    });
  } catch {
    res.status(500).render('partials/500', {layout: false});
  }
}

async function deleteAll(req,res){
  try {
    const [{totalDryQuantity = 0, totalProduct = 0} ={}] = await ProductModel.aggregate([
      {
        $group:{
          _id:null,
          totalDryQuantity:{$sum:"$dryRubberUsed"},
          totalProduct:{$sum:"$quantity"}
        }
      }
    ])

    await ProductTotalModel.findOneAndUpdate({},{
      $inc: {
        dryRubber: totalDryQuantity,
        product: -totalProduct
      }
    },{
      new:true,
    });

    await ProductModel.deleteMany({});
    return handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa tất cả hàng hóa thành công !',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', {layout: false});
  }
}