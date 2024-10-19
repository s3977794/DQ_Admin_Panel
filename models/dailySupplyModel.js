const mongoose = require('mongoose');
const slug = require('mongoose-slug-generator');
mongoose.plugin(slug);

// Debt Schema
const debtSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number},
  paid: { type: Number },
});

// Money Retained Schema
const moneyRetainedSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number },
  percentage: { type: Number },
});

// Supplier Schema
const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  supplierAddress: { type: String, },
  phone: { type: String, required: true },
  identification: { type: String, required: true },
  issueDate: { type: String, required: true },
  manager: { type: Boolean, default: false },
  ratioRubberSplit: { type: Number, default: 100 },
  ratioSumSplit: { type: Number, default: 100 },
  supplierSlug: {
    type: String,
    default: function() {
      return `${this.code}-${Math.floor(100000 + Math.random() * 900000)}`;
    },
  },
  purchasedPrice: { type: Number, default: 0 },
  areaDeposit: { type: Number, default: 0 },
  debtAmount: { type: Number, default: function () {return this.purchasedAreaDimension *  this.purchasedPrice - this.areaDeposit} },
  debtPaidAmount: { type: Number, default: 0 },
  moneyRetainedAmount: { type: Number, default: 0 },
  moneyRetainedPercentage: { type: Number, default: 0 },
  debtHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DailySupply' }],
  moneyRetainedHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DailySupply' }],
  purchasedAreaDimension: { type: Number, default: 0 },
  areaDuration: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
});

// Raw Material Schema
const rawMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  percentage: { type: Number, required: true },
  quantity: { type: Number, required: true },
  ratioSplit: { type: Number, required: true },
  price: { type: Number, required: true },
});

// Data Schema
const dataSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  rawMaterial: [rawMaterialSchema],
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  debt: debtSchema,
  moneyRetained: moneyRetainedSchema,
  note: { type: String },
});

// Daily Supply Schema
const dailySupplySchema = new mongoose.Schema({
  accountID: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },
  name: { type: String, required: true },
  data: [dataSchema],
  suppliers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
  limitData: { type: Number },
  areaDimension: { type: Number },
  remainingAreaDimension: {
    type: Number,
    default: function() {
      return this.areaDimension;
    },
  },
  contractDuration: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  areaPrice: { type: Number },
  address: { type: String, required: true },
  slug: { type: String, slug: 'name' },
});

const Supplier = mongoose.model('Supplier', supplierSchema);
const DailySupply = mongoose.model('DailySupply', dailySupplySchema);

// Middleware to calculate debt and money retained
dataSchema.pre('save', async function(next) {
  let totalSupplierProfit = 0;
  let debtPaid = 0;
  let moneyRetained = 0;

  // Ensure supplier is populated
  if (!this.supplier || !this.supplier.moneyRetainedPercentage) {
    const supplier = await mongoose.model('Supplier').findById(this.supplier);
    if (!supplier) {
      return next(new Error('Supplier not found'));
    }
    this.supplier = supplier;
  }

  this.rawMaterial.forEach(material => {
    const { name, quantity, percentage, ratioSplit, price } = material;
    console.log(`Material: ${name}, Quantity: ${quantity}, Percentage: ${percentage}, RatioSplit: ${ratioSplit}, Price: ${price}`);
    
    if (name === 'Mủ nước') {
      const profitContribution = quantity * (percentage / 100) * (ratioSplit / 100) * price;
      const debtContribution = quantity * (percentage / 100) * ((100 - ratioSplit) / 100) * price;
      totalSupplierProfit += profitContribution;
      debtPaid += debtContribution;
      console.log(`Mủ nước - Profit Contribution: ${profitContribution}, Debt Contribution: ${debtContribution}`);
    } else {
      const profitContribution = quantity * (ratioSplit / 100) * price;
      const debtContribution = quantity * ((100 - ratioSplit) / 100) * price;
      totalSupplierProfit += profitContribution;
      debtPaid += debtContribution;
      console.log(`Other Material - Profit Contribution: ${profitContribution}, Debt Contribution: ${debtContribution}`);
    }
  });

  moneyRetained = totalSupplierProfit * this.moneyRetained.percentage / 100;

  // Ensure this.debt is initialized
  if (!this.debt) {
    this.debt = {};
  }

  // Ensure this.moneyRetained is initialized
  if (!this.moneyRetained) {
    this.moneyRetained = {};
  }

  console.log(`Total Supplier Profit: ${totalSupplierProfit}, Debt Paid: ${debtPaid}, Money Retained: ${moneyRetained}`);

  console.log(this.supplier.debtAmount)

  this.debt.amount = this.supplier.debtAmount - debtPaid;
  this.debt.paid = debtPaid;
  this.moneyRetained.amount = moneyRetained;

  // Update supplier's debt amount and save
  this.supplier.debtAmount = this.debt.amount;
  this.supplier.moneyRetainedAmount += debtPaid;
  await this.supplier.save();

  next();
});

module.exports = {
  Supplier,
  DailySupply,
};