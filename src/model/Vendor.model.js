// models/Vendor.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Vendor", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mobile: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
    },
    address: {
      type: DataTypes.TEXT
    },
    gstNumber: {
      type: DataTypes.STRING,
    },
    companyName: {
      type: DataTypes.STRING,
    }
  });
};
