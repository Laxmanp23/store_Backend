// models/Category.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Category", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      trim: true,
      comment: "Category name - must be unique"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Category description"
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Is category active for use"
    }
  });
};
