// models/Stock.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Stock", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    purchasePrice: DataTypes.DOUBLE,
    salePrice: DataTypes.DOUBLE,
    quantity: DataTypes.INTEGER,
    remainingQty: DataTypes.INTEGER
  });
};
