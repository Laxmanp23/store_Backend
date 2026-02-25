// models/Settings.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Settings", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Setting key name"
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Setting value (can be JSON string for complex data)"
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'general',
      comment: "Category: general, bill, notification, etc."
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Description of the setting"
    }
  });
};
