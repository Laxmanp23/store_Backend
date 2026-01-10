// models/Payment.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Payment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    amountPaid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Amount paid in this payment'
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Cash, Card, Cheque, Online, etc.'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about payment'
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Transaction ID for online payments'
    }
  });
};
