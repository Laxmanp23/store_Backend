const Sequelize = require("sequelize");
const sequelize = require("../config/config");

const User = require("./user.model")(sequelize, Sequelize);
const Category = require("./Category.model")(sequelize, Sequelize);
const Product = require("./Product.model")(sequelize, Sequelize);
const Stock = require("./Stock.model")(sequelize, Sequelize);
const Customer = require("./Customer.model")(sequelize, Sequelize);
const Sale = require("./Sale.model")(sequelize, Sequelize);
const SaleItem = require("./SaleItem.model")(sequelize, Sequelize);
const Payment = require("./Payment.model")(sequelize, Sequelize);
const Vendor = require("./Vendor.model")(sequelize, Sequelize);
const Purchase = require("./Purchase.model")(sequelize, Sequelize);
const PurchaseItem = require("./PurchaseItem.model")(sequelize, Sequelize);
const ProductVendor = require("./ProductVendor.model")(sequelize, Sequelize);
const Settings = require("./Settings.model")(sequelize, Sequelize);

// Category-Product relationship
Category.hasMany(Product, { foreignKey: "CategoryId" });
Product.belongsTo(Category, { foreignKey: "CategoryId" });

// Product-Vendor Many-to-Many relationship
Product.belongsToMany(Vendor, { through: ProductVendor, foreignKey: "ProductId" });
Vendor.belongsToMany(Product, { through: ProductVendor, foreignKey: "VendorId" });

// Relations
Product.hasMany(Stock, { foreignKey: "ProductId" });
Stock.belongsTo(Product, { foreignKey: "ProductId" });

// Stock-Vendor relation (which vendor supplied this batch)
Vendor.hasMany(Stock, { foreignKey: "VendorId" });
Stock.belongsTo(Vendor, { foreignKey: "VendorId" });

// Stock-Purchase relation
Purchase.hasMany(Stock, { foreignKey: "PurchaseId" });
Stock.belongsTo(Purchase, { foreignKey: "PurchaseId" });

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
  Sequelize,
  User,
  Category,
  Product,
  Stock,
  Customer,
  Sale,
  SaleItem,
  Payment,
  Vendor,
  Purchase,
  PurchaseItem,
  ProductVendor,
  Settings
};
