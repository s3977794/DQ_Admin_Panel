const mongoose = require("mongoose");

const spendSchema = new mongoose.Schema({
    date: Date, 
    product: String,
    quantity: {type: Number, default: 1},
    price:Number, 
    notes: String,
});


const spendModel = mongoose.model("Spend", spendSchema);


module.exports = spendModel;
