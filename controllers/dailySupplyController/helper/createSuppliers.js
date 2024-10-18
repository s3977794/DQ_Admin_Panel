const convertToDecimal = require('../../utils/convertToDecimal');
const ensureArray = input => (Array.isArray(input) ? input : [input]);

async function createSuppliers(req) {
  const {
    supplierName,
    code,
    manager,
    phone,
    identification,
    issueDate,
    supplierAddress,
    ratioSumSplit,
    ratioRubberSplit,
    areaDeposit,
    purchasedPrice,
    purchasedAreaDimension,
    areaDuration,
    moneyRetainedPercentage
  } = req.body;

  const suppliers = ensureArray(supplierName).map((name, index) => {
    if (name) {
      return {
        name,
        code: ensureArray(code)[index],
        manager: ensureArray(manager)[index],
        phone: ensureArray(phone)[index],
        identification: ensureArray(identification)[index],
        issueDate: ensureArray(issueDate)[index],
        address: ensureArray(supplierAddress)[index],
        ratioSumSplit: convertToDecimal(ensureArray(ratioSumSplit)[index]),
        ratioRubberSplit: convertToDecimal(ensureArray(ratioRubberSplit)[index]),
        areaDeposit: convertToDecimal(ensureArray(areaDeposit)[index]),
        purchasedPrice: convertToDecimal(ensureArray(purchasedPrice)[index]),
        purchasedAreaDimension: ensureArray(purchasedAreaDimension)[index],
        moneyRetainedPercentage: convertToDecimal(ensureArray(moneyRetainedPercentage)[index]),
        areaDuration: ensureArray(areaDuration)[index]
      };
    }
  }).filter(Boolean);

  return suppliers;
}

module.exports = createSuppliers;   