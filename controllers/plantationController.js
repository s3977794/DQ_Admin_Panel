const PlantationModel = require('../models/plantationModel');
const handleResponse = require('./utils/handleResponse');
const AreaModel = require('../models/areaModel');
const ManagerModel = require('../models/managerModel');
const ProductModel = require('../models/productModel');
const trimStringFields = require('./utils/trimStringFields');

module.exports = {
  // Main page
  createPlantation,
  updatePlantation,
  deletePlantation,
  deleteAllPlantation,
  getPlantations,
  renderPage,

  // Detail page
  renderDetailPage,
  addData,
  getDatas,
  updateData,
  deleteData,
};

async function findOrCreate(model, name) {
  if (!name || name.trim() === '') {
    return null;
  }
  let item = await model.findOne({ name });
  if (!item) {
    item = await model.create({ name });
  }
  return item._id;
}

async function createPlantation(req, res) {
  try {
    // Trim all string fields
    req.body = trimStringFields(req.body);

    // Validate information
    // Check if a plantation with the same code or name already exists
    let query = { name: req.body.code };

    if (req.body.name && req.body.name !== '') {
      query.name = req.body.name;
    }

    const existingPlantation = await PlantationModel.findOne(query);

    if (existingPlantation) {
      return handleResponse(
        req,
        res,
        400,
        'fail',
        'Mã vườn hoặc tên vườn bị trùng với vườn khác!',
        '/quan-ly-vuon',
      );
    }

    // Find or create the area and manager
    let area = await findOrCreate(AreaModel, req.body.areaID);
    let manager = await findOrCreate(ManagerModel, req.body.managerID);
    // End Validate information

    // Prepare the data for the new plantation
    let plantationData = {
      ...req.body,
      areaID: area,
      managerID: manager,
    };

    // Create the new plantation
    const plantation = await PlantationModel.create(plantationData);

    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Tạo vườn mới thất bại!',
        '/quan-ly-vuon',
      );
    }

    // Add information for other model
    // Add the new plantation's id to the area
    if (area) {
      await AreaModel.findByIdAndUpdate(area._id, {
        $push: { plantations: plantation._id },
      });
    }

    // Add the new plantation's id to the manager
    if (manager) {
      await ManagerModel.findByIdAndUpdate(manager._id, {
        $push: { plantations: plantation._id },
      });
    }
    // End add information for other model

    return handleResponse(
      req,
      res,
      201,
      'success',
      'Tạo vườn mới thành công!',
      '/quan-ly-vuon',
    );
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function updatePlantation(req, res) {
  req.body = trimStringFields(req.body);
  const { id } = req.params;

  try {
    // Get the plantation first
    const plantation = await PlantationModel.findById(id);
    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn!',
        req.headers.referer,
      );
    }

    // Delete the manager
    if (req.body.deleteManager === 'yes') {
      await ManagerModel.findByIdAndDelete(plantation.managerID);
    }

    // Find or create the area and manager
    let area = await findOrCreate(AreaModel, req.body.newArea);
    let manager = await findOrCreate(ManagerModel, req.body.newManager);

    // If the area has changed, update the areas
    if (String(plantation.areaID) !== String(area._id)) {
      // Remove the plantation from the old area
      await AreaModel.findByIdAndUpdate(plantation.areaID, {
        $pull: { plantations: plantation._id },
      });

      // Add the plantation to the new area
      await AreaModel.findByIdAndUpdate(area._id, {
        $push: { plantations: plantation._id },
      });
    }

    // Update the plantation with the new information
    const updateFields = {
      ...req.body,
      areaID: area,
      managerID: manager,
    };

    // Save the updated plantation
    const updatedPlantation = await PlantationModel.findByIdAndUpdate(
      id,
      updateFields,
      { new: true },
    );

    if (!updatedPlantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn!',
        req.headers.referer,
      );
    }

    // linked the new manager to the plantation
    if (req.body.newManager) {
      const managerData = await ManagerModel.findById(manager);
      if (!managerData.plantations.includes(updatedPlantation._id)) {
        await ManagerModel.findByIdAndUpdate(manager, {
          $push: { plantations: updatedPlantation._id },
        });
      }
    }

    // Return the updated plantation
    handleResponse(
      req,
      res,
      200,
      'success',
      'Thay đổi thông tin thành công',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function deletePlantation(req, res) {
  try {
    const plantationId = req.params.id;
    const { deleteManager } = req.body;

    const plantation = await PlantationModel.findById(plantationId);
    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn cần xóa!',
        '/quan-ly-vuon',
      );
    }

    if (deleteManager === 'yes') {
      await ManagerModel.findByIdAndDelete(plantation.managerID);
    }

    await PlantationModel.findByIdAndDelete(plantationId);

    const message =
      deleteManager === 'yes'
        ? 'Xóa vườn và người quản lý thành công!'
        : 'Xóa vườn thành công!';
    return handleResponse(req, res, 200, 'success', message, '/quan-ly-vuon');
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function deleteAllPlantation(req, res) {
  try {
    const { deleteManager } = req.body;

    const plantations = await PlantationModel.find({});

    if (deleteManager === 'yes') {
      const managerIds = plantations.map(plantation => plantation.managerID);
      await ManagerModel.deleteMany({ _id: { $in: managerIds } });
    }

    await PlantationModel.deleteMany({});

    return handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa tất cả vườn và người quản lý thành công!',
      '/quan-ly-vuon',
    );
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function getPlantations(req, res) {
  try {
    const { draw, start = 0, length = 10, search, order, columns } = req.body;
    const searchValue = search?.value || '';
    const sortColumn = columns?.[order?.[0]?.column]?.data;
    const sortDirection = order?.[0]?.dir === 'asc' ? 1 : -1;

    const [areas, managers] = await Promise.all([
      AreaModel.find({ name: { $regex: searchValue, $options: 'i' } }),
      ManagerModel.find({ name: { $regex: searchValue, $options: 'i' } }),
    ]);

    const searchQuery = searchValue
      ? {
          $or: [
            { name: { $regex: searchValue, $options: 'i' } },
            { code: { $regex: searchValue, $options: 'i' } },
            { plantationArea: { $regex: searchValue, $options: 'i' } },
            { areaID: { $in: areas.map(area => area._id) } },
            { managerID: { $in: managers.map(manager => manager._id) } },
          ],
        }
      : {};

    const [totalRecords, filteredRecords, plantations] = await Promise.all([
      PlantationModel.countDocuments(),
      PlantationModel.countDocuments(searchQuery),
      PlantationModel.find(searchQuery)
        .populate('areaID')
        .populate('managerID')
        .sort({ [sortColumn]: sortDirection })
        .skip(parseInt(start, 10))
        .limit(parseInt(length, 10))
        .exec(),
    ]);

    const data = await Promise.all(
      plantations.map(async (plantation, index) => ({
        no: parseInt(start, 10) + index + 1,
        areaID: plantation.areaID?.name || '',
        code: plantation.code || '',
        name: plantation.name || '',
        managerID: plantation.managerID?.name || '',
        contactDuration:
          (await plantation.calculateRemainingDays()) || 'Không hợp đồng',
        totalRemainingDays: await plantation.calculateTotalRemainingDays(),
        plantationArea: plantation.plantationArea || '',
        slug: plantation.slug,
        id: plantation._id,
      })),
    );

    if (sortColumn === 'contactDuration') {
      data.sort(
        (a, b) => sortDirection * (a.totalRemainingDays - b.totalRemainingDays),
      );
    }

    res.json({
      draw,
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data,
    });
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}
async function renderPage(req, res) {
  try {
    const plantations = await PlantationModel.find({})
      .populate({ path: 'managerID', populate: { path: 'plantations' } })
      .populate('areaID')
      .exec();
    const areas = await AreaModel.find({});
    const managers = await ManagerModel.find({});
    res.render('src/plantationPage', {
      layout: './layouts/defaultLayout',
      title: 'Quản lý vườn',
      plantations,
      managers,
      areas,
      messages: req.flash(),
    });
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function renderDetailPage(req, res) {
  try {
    const { slug } = req.params;
    const plantation = await PlantationModel.findOne({ slug })
      .populate('areaID')
      .populate('managerID')
      .exec();
    const areas = await AreaModel.find({});
    const products = await ProductModel.find({});
    const managers = await ManagerModel.find({});
    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn!',
        '/quan-ly-vuon',
      );
      return res.status(404);
    }
    res.render('src/plantationDetailPage', {
      layout: './layouts/defaultLayout',
      title: `Chi tiết vườn ${plantation.name}`,
      plantation,
      areas,
      products,
      managers,
      messages: req.flash(),
    });
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function addData(req, res) {
  req.body = trimStringFields(req.body);

  try {
    const plantation = await PlantationModel.findOne({ slug: req.params.slug });
    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không thể tìm thấy vườn!',
        req.headers.referer,
      );
    }

    // Extract data from request body
    const {
      date,
      note,
      dryRubber,
      dryQuantity,
      dryPercentage,
      mixedRubber,
      mixedQuantity,
    } = req.body;

    // Convert numeric fields from Vietnamese format to standard JavaScript format
    const formattedDryQuantity = parseFloat(dryQuantity.replace(',', '.'));
    const formattedDryPercentage = parseFloat(dryPercentage.replace(',', '.'));
    const formattedMixedQuantity = parseFloat(mixedQuantity.replace(',', '.'));

    // Create new data object with formatted numbers
    const newData = {
      date,
      notes: note,
      products: {
        dryRubber,
        dryQuantity: formattedDryQuantity,
        dryPercentage: formattedDryPercentage,
        mixedRubber,
        mixedQuantity: formattedMixedQuantity,
      },
    };

    // Push new data to plantation array and save
    plantation.data.push(newData);
    const savedPlantation = await plantation.save();

    if (!savedPlantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Thêm thông tin mới thất bại!',
        req.headers.referer,
      );
    }

    // Successful response
    return handleResponse(
      req,
      res,
      201,
      'success',
      'Thêm thông tin mới thành công!',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function getDatas(req, res) {
  try {
    const { slug } = req.params;
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
    const searchValue =
      (search && search.value && search.value.toLowerCase()) || '';
    const sortColumn =
      columns &&
      order &&
      order[0] &&
      columns[order[0].column] &&
      columns[order[0].column].data;
    const sortDirection = order && order[0] && order[0].dir === 'asc' ? 1 : -1;

    const plantation = await PlantationModel.findOne({ slug });

    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn!',
        req.headers.referer,
      );
    }

    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    let filteredData = plantation.data.filter(item => {
      const itemDate = new Date(item.date);
      if (startDateObj && itemDate < startDateObj) return false;
      if (endDateObj && itemDate > endDateObj) return false;

      const date = new Date(item.date);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      if (
        formattedDate.includes(searchValue) ||
        (item.notes && item.notes.toLowerCase().includes(searchValue))
      ) {
        return true;
      }

      for (let column of columns) {
        let columnValue;
        if (
          column.data === 'dryQuantity' ||
          column.data === 'dryPercentage' ||
          column.data === 'mixedQuantity'
        ) {
          columnValue = item.products[column.data]?.toString().toLowerCase();
        } else if (column.data === 'dryTotal') {
          const dryQuantity = item.products?.dryQuantity
            ? parseFloat(item.products.dryQuantity.toString().replace(',', '.'))
            : 0;
          const dryPercentage = item.products?.dryPercentage
            ? parseFloat(
                item.products.dryPercentage.toString().replace(',', '.'),
              )
            : 0;
          const dryTotal = (dryQuantity * dryPercentage) / 100 || 0;
          columnValue = dryTotal.toString().replace('.', ',').toLowerCase();
        } else {
          columnValue = item[column.data]?.toString().toLowerCase();
        }
        if (columnValue && columnValue.includes(searchValue)) {
          return true;
        }
      }

      return false;
    });

    filteredData.sort((a, b) => {
      if (sortColumn === 'date') {
        return (new Date(a.date) - new Date(b.date)) * sortDirection;
      }

      if (sortColumn) {
        const aValue =
          (a[sortColumn] && a[sortColumn].toString().toLowerCase()) || '';
        const bValue =
          (b[sortColumn] && b[sortColumn].toString().toLowerCase()) || '';

        if (sortColumn === 'dryTotal' || sortColumn === 'mixedTotal') {
          const aValueNumeric =
            (a.products &&
              a.products.dryQuantity &&
              a.products.dryPercentage &&
              (a.products.dryQuantity * a.products.dryPercentage) / 100) ||
            0;
          const bValueNumeric =
            (b.products &&
              b.products.dryQuantity &&
              b.products.dryPercentage &&
              (b.products.dryQuantity * b.products.dryPercentage) / 100) ||
            0;

          return (aValueNumeric - bValueNumeric) * sortDirection;
        }

        return (aValue < bValue ? -1 : aValue > bValue ? 1 : 0) * sortDirection;
      }

      return 0;
    });

    const paginatedData = filteredData.slice(start, start + length);

    const data = paginatedData.map((record, index) => ({
      no: parseInt(start, 10) + index + 1,
      date: record.date.toLocaleDateString(),
      dryQuantity: (record.products && record.products.dryQuantity) || 0,
      dryPercentage: (record.products && record.products.dryPercentage) || 0,
      dryTotal:
        (record.products &&
          record.products.dryQuantity &&
          record.products.dryPercentage &&
          (record.products.dryQuantity * record.products.dryPercentage) /
            100) ||
        0,
      mixedQuantity: (record.products && record.products.mixedQuantity) || 0,
      notes: record.notes || '',
      id: record._id,
    }));

    res.json({
      draw,
      recordsTotal: plantation.data.length,
      recordsFiltered: filteredData.length,
      data,
    });
  } catch (error) {
    console.error('Error in getDatas:', error);
    res.status(500).render('partials/500').json({ error: error.message });
  }
}

async function updateData(req, res) {
  req.body = trimStringFields(req.body);
  try {
    const { slug, id } = req.params;
    const plantation = await PlantationModel.findOne({ slug });
    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn!',
        req.headers.referer,
      );
    }
    const data = plantation.data.id(id);
    if (!data) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy thông tin!',
        req.headers.referer,
      );
    }

    const updateFields = {
      notes: req.body.notes,
      ...req.body,
      'products.dryQuantity': parseFloat(
        req.body.dryQuantity.replace(',', '.'),
      ),
      'products.dryPercentage': parseFloat(
        req.body.dryPercentage.replace(',', '.'),
      ),
      'products.mixedQuantity': parseFloat(
        req.body.mixedQuantity.replace(',', '.'),
      ),
    };
    data.set(updateFields);

    const savedData = await plantation.save();
    if (!savedData) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Cập nhật thông tin thất bại!',
        req.headers.referer,
      );
    }
    return handleResponse(
      req,
      res,
      200,
      'success',
      'Cập nhật thông tin thành công!',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}

async function deleteData(req, res) {
  try {
    const { slug, id } = req.params;
    const plantation = await PlantationModel.findOneAndUpdate(
      { slug },
      { $pull: { data: { _id: id } } },
      { new: true },
    );
    if (!plantation) {
      return handleResponse(
        req,
        res,
        404,
        'fail',
        'Không tìm thấy vườn!',
        req.headers.referer,
      );
    }
    return handleResponse(
      req,
      res,
      200,
      'success',
      'Xóa thông tin thành công!',
      req.headers.referer,
    );
  } catch {
    res.status(500).render('partials/500', { layout: false });
  }
}
