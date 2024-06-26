const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
    date: Date,
    plantation: String,
    notes: String,
    products: {
        dryQuantity: Number,
        dryPercentage: Number,
        mixedQuantity: Number,
    },
});

const rawMaterialModel = mongoose.model('Dữ liệu', rawMaterialSchema);

module.exports = rawMaterialModel;
 