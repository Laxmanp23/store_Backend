// models/Payment.js
module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define("Payment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    CustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },

    paymentMode: {
      type: DataTypes.ENUM("CASH", "UPI", "BANK", "CARD"),
      defaultValue: "CASH"
    },

    paymentDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },

    remark: {
      type: DataTypes.STRING
    }
  });

  return Payment;
};
