const mongoose = require("mongoose");
const slug = require('mongoose-slug-generator');
mongoose.plugin(slug);

const supplierSchema = new mongoose.Schema({
    name: String,
    code: String,
    address: String,
    phone: String,
    identification: String,
    issueDate: String,
    ratioSplit: {
        type: Number,
        default: 0
    },
    ratioMuNuocSplit: {
        type: Number,
        default: 0
    },
    supplierSlug: {
        type: String,
        default: () => `${this.code}-${Math.floor(100000 + Math.random() * 900000)}`
    }
});

const dailySupplySchema = new mongoose.Schema({
    accountID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Accounts',
    },
    name: String,
    limitData: Number,
    data: [{
        date: Date,
        rawMaterial:[{
            name: String, 
            percentage: Number,
            quantity: Number,
            price: Number,  
        }],
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier' 
        },
        note: String,
    }],
    suppliers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier' 
    }],
    slug: {
        type: String,
        slug: 'name'
    }

});

const Supplier = mongoose.model("Supplier", supplierSchema);
const DailySupply = mongoose.model("DailySupply", dailySupplySchema);

module.exports = {
    Supplier,
    DailySupply
};