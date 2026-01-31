const Sequelize = require("sequelize");
const sequelize = require("../config/config");

const User = require("./user.model")(sequelize, Sequelize);
const Product = require("./Product.model")(sequelize, Sequelize);
const Stock = require("./Stock.model")(sequelize, Sequelize);
const Customer = require("./Customer.model")(sequelize, Sequelize);
const Sale = require("./Sale.model")(sequelize, Sequelize);
const SaleItem = require("./SaleItem.model")(sequelize, Sequelize);
const Payment = require("./Payment.model")(sequelize, Sequelize);
const Vendor = require("./Vendor.model")(sequelize, Sequelize);
const Purchase = require("./Purchase.model")(sequelize, Sequelize);
const PurchaseItem = require("./PurchaseItem.model")(sequelize, Sequelize);

// Relations
Product.hasMany(Stock, { foreignKey: "ProductId" });
Stock.belongsTo(Product, { foreignKey: "ProductId" });

Customer.hasMany(Sale, { foreignKey: "CustomerId" });
Sale.belongsTo(Customer, { foreignKey: "CustomerId" });

Sale.hasMany(SaleItem, { foreignKey: "saleId" });
SaleItem.belongsTo(Sale, { foreignKey: "saleId" });

Product.hasMany(SaleItem, { foreignKey: "ProductId" });
SaleItem.belongsTo(Product, { foreignKey: "ProductId" });

Sale.hasMany(Payment, { foreignKey: "saleId" });
Payment.belongsTo(Sale, { foreignKey: "saleId" });

Customer.hasMany(Payment, { foreignKey: "CustomerId" });
Payment.belongsTo(Customer, { foreignKey: "CustomerId" });

// Vendor Relations
Vendor.hasMany(Purchase, { foreignKey: "VendorId" });
Purchase.belongsTo(Vendor, { foreignKey: "VendorId" });

Purchase.hasMany(PurchaseItem, { foreignKey: "purchaseId" });
PurchaseItem.belongsTo(Purchase, { foreignKey: "purchaseId" });

Product.hasMany(PurchaseItem, { foreignKey: "ProductId" });
PurchaseItem.belongsTo(Product, { foreignKey: "ProductId" });


module.exports = {
  sequelize,
  User,
  Product,
  Stock,
  Customer,
  Sale,
  SaleItem,
  Payment,
  Vendor,
  Purchase,
  PurchaseItem
};
