// models/PurchaseItem.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("PurchaseItem", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    purchaseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Purchases',
        key: 'id'
      }
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    }
  });
};
