// models/Product.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Product", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: DataTypes.STRING,
    category: DataTypes.STRING,
    description: DataTypes.TEXT,
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Base cost price of product"
    },
    marginPercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 20,
      comment: "Profit margin percentage"
    }
  });
};
