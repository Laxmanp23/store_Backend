// models/Purchase.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Purchase", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    VendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Vendors',
        key: 'id'
      }
    },
    invoiceNumber: {
      type: DataTypes.STRING,
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    dueAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    paymentStatus: {
      type: DataTypes.ENUM('paid', 'partial', 'unpaid'),
      defaultValue: 'unpaid'
    },
    paymentMode: {
      type: DataTypes.STRING,
    },
    notes: {
      type: DataTypes.TEXT
    }
  });
};
