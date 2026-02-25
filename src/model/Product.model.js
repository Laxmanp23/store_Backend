// models/Product.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Product", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Product name - must be unique"
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: "Stock Keeping Unit - unique identifier"
    },
    CategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Category ID - foreign key to Category table"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Detailed product description"
    },
    // ========== UNIT ==========
    primaryUnit: {
      type: DataTypes.STRING(20),
      defaultValue: 'PCS',
      allowNull: false,
      comment: "Selling unit: PCS, KG, LITER, BOX, PACKET, etc."
    },
    // Legacy fields (kept for backward compatibility)
    secondaryUnit: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Legacy: Secondary unit for conversion"
    },
    conversionFactor: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 1,
      allowNull: true,
      comment: "Legacy: Conversion factor"
    },
    // ========== PRICING (Optional - prices set at Stock level) ==========
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Optional base cost price"
    },
    marginPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Optional profit margin percentage"
    },
    // ========== OTHER ==========
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Product image URL"
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Is product active for selling"
    }
  }, {
    indexes: [
      { fields: ['name'] },
      { fields: ['sku'], unique: true },
      { fields: ['CategoryId'] },
      { fields: ['isActive'] }
    ]
  });
};
