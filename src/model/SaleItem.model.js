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
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      comment: "Quantity sold (supports decimal for loose items)"
    },

    unit: {
      type: DataTypes.STRING(20),
      defaultValue: 'PCS',
      allowNull: false,
      comment: "Unit in which item was sold: BAG, KG, PCS, etc."
    },

    sellingPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price per unit after discount"
    },

    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "quantity * sellingPrice"
    },

    // Krishi Kendra fields - Batch & Expiry tracking
    batchNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Batch/Lot number for agricultural products"
    },

    mfgDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Manufacturing date"
    },

    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Expiry date"
    },

    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Manufacturer/Company name"
    }
  });

  return SaleItem;
};
