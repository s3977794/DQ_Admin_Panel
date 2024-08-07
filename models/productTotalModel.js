const mongoose = require('mongoose');

const productTotalSchema = new mongoose.Schema({
    dryRubber: {
        type: Number,
        default: 0
    },
    mixedQuantity:{
        type: Number,
        default: 0
    },
    product:{
        type:Number,
        default: 0
    }, 
    income:{
        type:Number,
        default: 0
    },
    spend:{
        type:Number,
        default: 0
    },
    profit:{
        type:Number,
        default: 0
    },
});

const productTotalModel = mongoose.model('TotalProducts', productTotalSchema);

module.exports = productTotalModel;
 