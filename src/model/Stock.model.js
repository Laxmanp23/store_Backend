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
    VendorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Vendor who supplied this stock batch"
    },
    PurchaseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Purchase order this stock came from"
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Purchase price per unit (same unit as quantity)"
    },
    salePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Sale price per unit (same unit as quantity)"
    },
    originalQuantity: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      comment: "Original quantity when batch was added - never changes"
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      comment: "Current available quantity - decreases on sales (can be decimal for loose items)"
    },
    unit: {
      type: DataTypes.STRING(20),
      defaultValue: 'PCS',
      allowNull: false,
      comment: "Unit for this stock batch: BAG, KG, LITER, PCS, etc."
    },
    batchNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Batch/Lot number for tracking"
    },
    mfgDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Manufacturing date"
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiry date if applicable"
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Manufacturer/Company name"
    }
  }, {
    indexes: [
      { fields: ['ProductId'] },
      { fields: ['VendorId'] },
      { fields: ['PurchaseId'] },
      { fields: ['quantity'] },
      { fields: ['batchNumber'] },
      { fields: ['expiryDate'] }
    ]
  });
};
