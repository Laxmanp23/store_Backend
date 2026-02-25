// models/ProductVendor.js - Junction table for Product-Vendor many-to-many
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("ProductVendor", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    VendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Vendors',
        key: 'id'
      }
    },
    vendorProductCode: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Product code used by vendor"
    },
    minimumOrderQty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
      comment: "Minimum quantity for ordering"
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Days to deliver from vendor"
    },
    isPreferredVendor: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Is this the preferred vendor for this product"
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['ProductId', 'VendorId']
      }
    ]
  });
};
