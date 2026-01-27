// models/Sale.js
module.exports = (sequelize, DataTypes) => {
  const Sale = sequelize.define("Sale", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    CustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    invoiceNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },

    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Grand total of all sale items"
    },

    totalPaid: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: "Total amount paid so far"
    },

    paymentStatus: {
      type: DataTypes.ENUM("PENDING", "PARTIAL", "COMPLETED"),
      defaultValue: "PENDING",
      comment: "Payment status of the sale"
    },

    remainingBalance: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.totalAmount - this.totalPaid;
      }
    },

    note: {
      type: DataTypes.STRING
    },

    invoiceDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  return Sale;
};
