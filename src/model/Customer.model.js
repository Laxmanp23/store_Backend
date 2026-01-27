// models/Customer.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Customer", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
    },

    mobile: {
      type: DataTypes.STRING,
    },

    address: {
      type: DataTypes.TEXT
    }
  });
};
