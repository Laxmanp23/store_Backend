const Sequelize = require("sequelize");
const sequelize = require("../config/config");

const User = require("./user.model")(sequelize, Sequelize);
const Product = require("./Product.model")(sequelize, Sequelize);
const Stock = require("./Stock.model")(sequelize, Sequelize);
const Customer = require("./Customer.model")(sequelize, Sequelize);
const Sale = require("./Sale.model")(sequelize, Sequelize);
const Payment = require("./Payment.model")(sequelize, Sequelize);

// Relations
Product.hasMany(Stock);
Stock.belongsTo(Product);

Product.hasMany(Sale);
Sale.belongsTo(Product);

Customer.hasMany(Sale);
Sale.belongsTo(Customer);

Stock.hasMany(Sale);
Sale.belongsTo(Stock);

Sale.hasMany(Payment);
Payment.belongsTo(Sale);

Customer.hasMany(Payment);
Payment.belongsTo(Customer);

module.exports = {
  sequelize,
  User,
  Product,
  Stock,
  Customer,
  Sale,
  Payment
};
