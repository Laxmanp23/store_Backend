// models/Customer.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Customer", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: DataTypes.STRING,
    mobile: DataTypes.STRING,
    phone: DataTypes.STRING,
    address: DataTypes.TEXT
  });
};
