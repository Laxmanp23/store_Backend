// models/Product.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Product", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: DataTypes.STRING,
    category: DataTypes.STRING,
    description: DataTypes.TEXT
  });
};
