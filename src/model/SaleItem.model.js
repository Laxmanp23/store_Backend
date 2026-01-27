// models/SaleItem.js
module.exports = (sequelize, DataTypes) => {
  const SaleItem = sequelize.define("SaleItem", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    sellingPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Final price after % / discount"
    },

    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "quantity * sellingPrice"
    }
  });

  return SaleItem;
};
