const { DailySupply, Supplier } = require('../../models/dailySupplyModel');

module.exports = {
  getData,

  // DetailPage
  getAreaSupplierData,

  // User side for input data
  getSupplierData,

  // Admin side for export data
  getSupplierExportData,

  // Admin side for exportin individual data
  getIndividualSupplierExportData,
};

// Get today date in UTC+7
function getTodayDate() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  console.log(today);
  return today;
}

function adjustDates(startDate, endDate) {
  const today = getTodayDate();
  if (!startDate && !endDate) {
    return { effectiveStartDate: today, effectiveEndDate: today };
  } else if (startDate && !endDate) {
    return { effectiveStartDate: startDate, effectiveEndDate: today };
  } else if (!startDate && endDate) {
    return { effectiveStartDate: endDate, effectiveEndDate: endDate };
  }
  return { effectiveStartDate: startDate, effectiveEndDate: endDate };
}

function createDateFilter(startDateUTC, endDateUTC) {
  return {
    'data.date': {
      $gte: new Date(startDateUTC),
      $lte: new Date(endDateUTC),
    },
  };
}

function parseDates(startDate, endDate) {
  const { effectiveStartDate, effectiveEndDate } = adjustDates(
    startDate,
    endDate,
  );
  const startDateUTC = new Date(effectiveStartDate);
  startDateUTC.setUTCHours(0, 0, 0, 0);
  const endDateUTC = new Date(effectiveEndDate);
  endDateUTC.setUTCHours(23, 59, 59, 999);
  return { startDateUTC, endDateUTC };
}

// Function to calculate contract duration and status
function calculateContractDuration(startDate, endDate) {
  const today = new Date();
  today.setUTCHours(today.getUTCHours() + 7);

  if (!startDate && !endDate) {
    return { duration: null, status: 'No contract' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < today) {
    return {
      duration: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      status: 'expired',
    };
  } else if (start <= today && end >= today) {
    return {
      duration: Math.ceil((end - today) / (1000 * 60 * 60 * 24)),
      status: 'valid',
    };
  }

  return { duration: null, status: 'No contract' };
}

async function getData(req, res) {
  try {
    const { draw, start, length, search, order, columns } = req.body;

    const searchValue = search?.value || '';
    const sortColumn = columns?.[order?.[0]?.column]?.data;
    const sortDirection = order?.[0]?.dir === 'asc' ? 1 : -1;

    // Define the filter object based on the search value
    const filter = searchValue
      ? { name: { $regex: searchValue, $options: 'i' } }
      : {};

    const sortObject = sortColumn ? { [sortColumn]: sortDirection } : {};

    // Count the total and filtered records
    const totalRecords = await DailySupply.countDocuments();
    const filteredRecords = await DailySupply.countDocuments(filter);

    const products = await DailySupply.find(filter)
      .sort(sortObject)
      .skip(parseInt(start, 10))
      .limit(parseInt(length, 10))
      .populate('accountID');

    // Map the products to the desired format
    const data = products.map((product, index) => {
      const { duration, status } = calculateContractDuration(
        product.contractDuration.start,
        product.contractDuration.end,
      );
      return {
        no: parseInt(start, 10) + index + 1,
        area: product.name || '',
        accountID: product.accountID?.username || '',
        link: {
          _id: product._id,
          slug: product.slug,
        },
        contractDuration: {
          duration: duration,
          status: status,
        },
      };
    });

    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data,
    });
  } catch (err) {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function getSupplierData(req, res) {
  await getSupplierInputData(req, res, true);
}

async function getAreaSupplierData(req, res) {
  await getSupplierInputData(req, res, true);
}

async function getSupplierInputData(req, res, isArea) {
  try {
    const { draw, search, startDate, endDate } = req.body;
    const searchValue = search?.value?.toLowerCase() || '';

    const { startDateUTC, endDateUTC } = parseDates(startDate, endDate);
    const dateFilter = createDateFilter(startDateUTC, endDateUTC);
    const matchStage = createMatchStage(
      req.params.slug,
      dateFilter,
      searchValue,
    );
    const sortStage = { $sort: { 'data.date': -1 } };
    const pipeline = createPipeline(req.params.slug, matchStage, sortStage);

    const result = await DailySupply.aggregate(pipeline);
    const totalRecords = result[0].totalRecords[0]?.count || 0;
    const data = result[0].data;

    const flattenedData = flattenData(data, isArea);

    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: totalRecords,
      data: flattenedData,
    });
  } catch (error) {
    console.error('Error fetching supplier data:', error);
    res.status(500).render('partials/500', { layout: false });
  }

  function createMatchStage(slug, dateFilter, searchValue) {
    return {
      $match: {
        slug,
        ...dateFilter,
        ...(searchValue && {
          $or: [
            { 'supplier.name': { $regex: searchValue, $options: 'i' } },
            { 'supplier.code': { $regex: searchValue, $options: 'i' } },
          ],
        }),
      },
    };
  }

  function createPipeline(slug, matchStage, sortStage) {
    return [
      { $match: { slug } },
      { $unwind: '$data' },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'data.supplier',
          foreignField: '_id',
          as: 'supplier',
        },
      },
      { $unwind: '$supplier' },
      matchStage,
      sortStage,
      {
        $facet: {
          data: [],
          totalRecords: [{ $count: 'count' }],
        },
      },
    ];
  }

  function flattenData(data, isArea) {
    return data.map((item, index) => {
      const rawMaterials = item.data.rawMaterial.reduce((acc, raw) => {
        acc[raw.name] = {
          quantity: raw.quantity || '',
          percentage: raw.percentage || '',
        };
        return acc;
      }, {});

      const muNuocQuantity = rawMaterials['Mủ nước']?.quantity || 0;
      const muNuocPercentage = rawMaterials['Mủ nước']?.percentage || 0;
      const muNuocQuantityTotal = Number(
        ((muNuocQuantity * muNuocPercentage) / 100).toFixed(5),
      );
      return {
        no: index + 1,
        date: new Date(item.data.date).toLocaleDateString('vi-VN'),
        supplier: item.supplier.name || '',
        ...(isArea && { code: item.supplier.code || '' }),
        muNuocQuantity: muNuocQuantity.toLocaleString('vi-VN') || '',
        muNuocPercentage: muNuocPercentage.toLocaleString('vi-VN') || '',
        muNuocQuantityTotal: muNuocQuantityTotal.toLocaleString('vi-VN') || '',
        muTapQuantity:
          rawMaterials['Mủ tạp']?.quantity?.toLocaleString('vi-VN') || '',
        muKeQuantity:
          rawMaterials['Mủ ké']?.quantity?.toLocaleString('vi-VN') || '',
        muDongQuantity:
          rawMaterials['Mủ đông']?.quantity?.toLocaleString('vi-VN') || '',
        note: item.data.note || '',
        id: item.data._id,
      };
    });
  }
}

async function getSupplierExportData(req, res, isArea) {
  try {
    const { draw, search, startDate, endDate } = req.body;
    const searchValue = search?.value?.toLowerCase() || '';

    const { startDateUTC, endDateUTC } = parseDates(startDate, endDate);
    const dateFilter = createDateFilter(startDateUTC, endDateUTC);
    const matchStage = createMatchStage(
      req.params.slug,
      dateFilter,
      searchValue,
    );

    const pipeline = createPipeline(req.params.slug, matchStage);

    const result = await DailySupply.aggregate(pipeline);
    const totalRecords = result[0].totalRecords[0]?.count || 0;
    const data = result[0].data;

    const flattenedData = flattenData(data, isArea);
    console.log(data);
    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: totalRecords,
      data: flattenedData,
    });
  } catch (error) {
    console.error('Error fetching supplier data:', error);
    res.status(500).render('partials/500', { layout: false });
  }

  function createMatchStage(slug, dateFilter, searchValue) {
    return {
      $match: {
        slug,
        ...dateFilter,
        ...(searchValue && {
          $or: [
            { 'supplier.name': { $regex: searchValue, $options: 'i' } },
            { 'supplier.code': { $regex: searchValue, $options: 'i' } },
          ],
        }),
      },
    };
  }

  function createPipeline(slug, matchStage) {
    return [
      { $match: { slug } },
      { $unwind: '$data' },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'data.supplier',
          foreignField: '_id',
          as: 'supplier',
        },
      },
      { $unwind: '$supplier' },
      {
        $lookup: {
          from: 'debts',
          localField: 'supplier.debtHistory',
          foreignField: '_id',
          as: 'supplier.debtHistory',
        },
      },
      {
        $lookup: {
          from: 'moneyretaineds',
          localField: 'supplier.moneyRetainedHistory',
          foreignField: '_id',
          as: 'supplier.moneyRetainedHistory',
        },
      },
      matchStage,
      {
        $group: {
          _id: '$supplier._id',
          supplier: { $first: '$supplier' },
          rawMaterials: {
            $push: '$data.rawMaterial',
          },
          notes: { $push: '$data.note' },
        },
      },
      {
        $facet: {
          data: [],
          totalRecords: [{ $count: 'count' }],
        },
      },
    ];
  }

  function calculateTotalDebtPaidAmount(debtHistory) {
    return debtHistory.reduce((total, debt) => total + (debt.debtPaidAmount || 0), 0);
  }

  function calculateRemainingDebt(initialDebtAmount, totalDebtPaidAmount) {
    return initialDebtAmount - totalDebtPaidAmount;
  }

  function flattenData(data, isArea) {
    const formatNumber = num => (num > 0 ? num.toLocaleString('vi-VN') : '');

    const calculateMaterialData = material => {
      if (!material)
        return {
          quantity: 0,
          ratioSplit: 0,
          price: 0,
          total: 0,
          afterSplit: 0,
        };

      let quantity = 0;
      let total = 0;
      let ratioSplit = 0;
      let price = 0;

      material.rawMaterial.forEach(raw => {
        quantity += raw.quantity || 0;
        ratioSplit += raw.ratioSplit || 0;
        if (raw.price) {
          price += raw.price;
          total +=
            raw.name === 'Mủ nước'
              ? ((((raw.quantity * (raw.percentage || 0)) / 100) *
                  (raw.ratioSplit || 0)) / 100) *
                raw.price
              : ((raw.quantity * (raw.ratioSplit || 0)) / 100) * raw.price;
        }
      });

      const count = material.count;
      return {
        quantity,
        ratioSplit: count > 0 ? ratioSplit / count : 0,
        price: count > 0 ? price / count : 0,
        total,
        afterSplit: quantity * (ratioSplit / 100) || 0,
      };
    };

    return data.map((item, index) => {
      const rawMaterials = item.rawMaterials.reduce((acc, rawMaterialArray) => {
        rawMaterialArray.forEach(raw => {
          if (!acc[raw.name]) {
            acc[raw.name] = {
              quantity: 0,
              percentage: 0,
              price: 0,
              ratioSplit: 0,
              total: 0,
              count: 0,
              rawMaterial: [],
            };
          }
          acc[raw.name].quantity += raw.quantity || 0;
          acc[raw.name].ratioSplit += raw.ratioSplit || 0;
          acc[raw.name].count++;
          if (raw.price) {
            acc[raw.name].price += raw.price;
            acc[raw.name].total +=
              raw.name === 'Mủ nước'
                ? ((((raw.quantity * (raw.percentage || 0)) / 100) *
                    (raw.ratioSplit || 0)) / 100) *
                  raw.price
                : ((raw.quantity * (raw.ratioSplit || 0)) / 100) * raw.price;
          }
          acc[raw.name].rawMaterial.push(raw);
        });
        return acc;
      }, {});

      const no = index + 1;
      const supplier = item.supplier.name || '';
      const code = isArea ? item.supplier.code || '' : undefined;

      const muQuyKhoData = calculateMaterialData(rawMaterials['Mủ nước']);
      const muTapData = calculateMaterialData(rawMaterials['Mủ tạp']);
      const muKeData = calculateMaterialData(rawMaterials['Mủ ké']);
      const muDongData = calculateMaterialData(rawMaterials['Mủ đông']);

      const totalSum = formatNumber(
        Object.values(rawMaterials).reduce(
          (sum, material) => sum + (material?.total || 0),
          0,
        ),
      );
      const note = item.notes.filter(Boolean).join(', ');
      const signature = '';

      // Calculate totalDebtPaidAmount and remainingDebt
      const totalDebtPaidAmount = calculateTotalDebtPaidAmount(item.supplier.debtHistory);
      const remainingDebt = calculateRemainingDebt(item.supplier.initialDebtAmount, totalDebtPaidAmount);

      return {
        no,
        supplier,
        ...(isArea && { code }),
        areaPurchased: item.supplier.purchasedAreaDimension,
        areaPrice: formatNumber(item.supplier.purchasedAreaPrice),
        areaTotal: formatNumber(
          item.supplier.purchasedAreaDimension *
            item.supplier.purchasedAreaPrice,
        ),
        areaDeposit: formatNumber(item.supplier.areaDeposit),
        debtPaidAmount: formatNumber(totalDebtPaidAmount),
        remainingDebt: formatNumber(remainingDebt),
        muQuyKhoQuantity: formatNumber(muQuyKhoData.quantity),
        muQuyKhoSplit: formatNumber(muQuyKhoData.ratioSplit),
        muQuyKhoQuantityAfterSplit: formatNumber(muQuyKhoData.afterSplit),
        muQuyKhoDonGia: formatNumber(muQuyKhoData.price),
        muQuyKhoTotal: formatNumber(muQuyKhoData.total),
        muTapQuantity: formatNumber(muTapData.quantity),
        muTapSplit: formatNumber(muTapData.ratioSplit),
        muTapAfterSplit: formatNumber(muTapData.afterSplit),
        muTapDonGia: formatNumber(muTapData.price),
        muTapTotal: formatNumber(muTapData.total),
        muKeQuantity: formatNumber(muKeData.quantity),
        muKeSplit: formatNumber(muKeData.ratioSplit),
        muKeAfterSplit: formatNumber(muKeData.afterSplit),
        muKeDonGia: formatNumber(muKeData.price),
        muKeTotal: formatNumber(muKeData.total),
        muDongQuantity: formatNumber(muDongData.quantity),
        muDongSplit: formatNumber(muDongData.ratioSplit),
        muDongAfterSplit: formatNumber(muDongData.afterSplit),
        muDongDonGia: formatNumber(muDongData.price),
        muDongTotal: formatNumber(muDongData.total),
        totalSum,
        note,
        signature,
      };
    });
  }
}

async function getIndividualSupplierExportData(req, res) {
  try {
    const { slug, supplierSlug } = req.params;
    const { draw, startDate, endDate, order } = req.body;

    const { startDateUTC, endDateUTC } = parseDates(startDate, endDate);
    const dateFilter = createDateFilter(startDateUTC, endDateUTC);

    const supplier = await Supplier.findOne({ supplierSlug });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const sortOrder = order && order[0] && order[0].dir === 'desc' ? -1 : 1;

    const pipeline = [
      { $match: { slug: slug } },
      { $unwind: '$data' },
      {
        $match: {
          'data.supplier': supplier._id,
          ...dateFilter,
        },
      },
      { $sort: { 'data.date': sortOrder } },
      {
        $facet: {
          totalRecords: [{ $count: 'count' }],
          data: [
            {
              $project: {
                _id: '$data._id',
                date: '$data.date',
                rawMaterial: '$data.rawMaterial',
                note: '$data.note',
                supplierId: '$data.supplier',
              },
            },
          ],
        },
      },
    ];

    const result = await DailySupply.aggregate(pipeline);

    const totalRecords = result[0].totalRecords[0]?.count || 0;
    const data = result[0].data;

    // Sort the data by date range
    data.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 1 ? dateA - dateB : dateB - dateA;
    });

    const { data: flattenedData, latestPrices } = flattenData(data);
    res.json({
      draw: parseInt(draw),
      recordsTotal: totalRecords,
      recordsFiltered: totalRecords,
      data: flattenedData,
      latestPrices: latestPrices,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  }

  function flattenData(data) {
    let latestPrices = {
      muNuoc: 0,
      muTap: 0,
      muKe: 0,
      muDong: 0,
    };

    const flattenedData = data.map((item, index) => {
      const rawMaterials = item.rawMaterial.reduce((acc, raw) => {
        acc[raw.name] = {
          quantity: raw.quantity || 0,
          percentage: raw.percentage || 0,
          price: raw.price || 0,
          ratioSplit: raw.ratioSplit || 100,
        };
        return acc;
      }, {});

      // Update latest prices
      if (rawMaterials['Mủ nước']?.price > 0)
        latestPrices.muNuoc = rawMaterials['Mủ nước'].price;
      if (rawMaterials['Mủ tạp']?.price > 0)
        latestPrices.muTap = rawMaterials['Mủ tạp'].price;
      if (rawMaterials['Mủ ké']?.price > 0)
        latestPrices.muKe = rawMaterials['Mủ ké'].price;
      if (rawMaterials['Mủ đông']?.price > 0)
        latestPrices.muDong = rawMaterials['Mủ đông'].price;

      const muNuoc = rawMaterials['Mủ nước'] || {
        quantity: 0,
        percentage: 0,
        ratioSplit: 100,
        price: 0,
      };
      const muDong = rawMaterials['Mủ đông'] || {
        quantity: 0,
        ratioSplit: 100,
        price: 0,
      };
      const muTap = rawMaterials['Mủ tạp'] || {
        quantity: 0,
        ratioSplit: 100,
        price: 0,
      };
      const muKe = rawMaterials['Mủ ké'] || {
        quantity: 0,
        ratioSplit: 100,
        price: 0,
      };

      const muQuyKhoTotal = (muNuoc.quantity * muNuoc.percentage) / 100;
      const muQuyKhoTotalAfterSplit = (muQuyKhoTotal * muNuoc.ratioSplit) / 100;
      const muTapTotalAfterSplit = (muTap.quantity * muTap.ratioSplit) / 100;
      const muKeTotalAfterSplit = (muKe.quantity * muKe.ratioSplit) / 100;
      const muDongTotalAfterSplit = (muDong.quantity * muDong.ratioSplit) / 100;

      const muQuyKhoTotalPrice = muQuyKhoTotalAfterSplit * muNuoc.price;
      const muTapTotalPrice = muTapTotalAfterSplit * muTap.price;
      const muKeTotalPrice = muKeTotalAfterSplit * muKe.price;
      const muDongTotalPrice = muDongTotalAfterSplit * muDong.price;

      return {
        no: index + 1,
        date: item.date.toLocaleDateString('vi-VN'),
        muNuocQuantity: muNuoc.quantity.toLocaleString('vi-VN'),
        muHamLuong: muNuoc.percentage.toLocaleString('vi-VN'),
        muQuyKhoTotal: muQuyKhoTotal.toLocaleString('vi-VN'),
        muQuyKhoPrice: muNuoc.price.toLocaleString('vi-VN'),
        muNuocRatioSplit: muNuoc.ratioSplit.toLocaleString('vi-VN'),
        muQuyKhoTotalAfterSplit:
          muQuyKhoTotalAfterSplit.toLocaleString('vi-VN'),
        muQuyKhoTotalPrice: muQuyKhoTotalPrice.toLocaleString('vi-VN'),
        muTapQuantity: muTap.quantity.toLocaleString('vi-VN'),
        muTapPrice: muTap.price.toLocaleString('vi-VN'),
        muTapRatioSplit: muTap.ratioSplit.toLocaleString('vi-VN'),
        muTapTotalAfterSplit: muTapTotalAfterSplit.toLocaleString('vi-VN'),
        muTapTotalPrice: muTapTotalPrice.toLocaleString('vi-VN'),
        muKeQuantity: muKe.quantity.toLocaleString('vi-VN'),
        muKePrice: muKe.price.toLocaleString('vi-VN'),
        muKeRatioSplit: muKe.ratioSplit.toLocaleString('vi-VN'),
        muKeTotalAfterSplit: muKeTotalAfterSplit.toLocaleString('vi-VN'),
        muKeTotalPrice: muKeTotalPrice.toLocaleString('vi-VN'),
        muDongQuantity: muDong.quantity.toLocaleString('vi-VN'),
        muDongPrice: muDong.price.toLocaleString('vi-VN'),
        muDongRatioSplit: muDong.ratioSplit.toLocaleString('vi-VN'),
        muDongTotalAfterSplit: muDongTotalAfterSplit.toLocaleString('vi-VN'),
        muDongTotalPrice: muDongTotalPrice.toLocaleString('vi-VN'),
        note: item.note || '',
        id: item._id,
      };
    });
    return {
      data: flattenedData,
      latestPrices: latestPrices,
    };
  }
}
