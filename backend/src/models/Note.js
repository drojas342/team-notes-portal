const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Note = sequelize.define(
  'Note',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'DONE'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    position_x: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    position_y: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'notes',
    timestamps: true,
  }
);

module.exports = Note;
