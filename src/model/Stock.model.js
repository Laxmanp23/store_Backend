// models/Stock.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Stock", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Foreign key to Product"
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    salePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Calculated from margin or manual"
    },
    originalQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Original quantity when batch was added - never changes"
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Current available quantity - decreases on sales"
    }
  });
};
