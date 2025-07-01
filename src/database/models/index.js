const fs = require('fs');
const path = require('path');
const { sequelize, Sequelize } = require('../index');

const db = {};

// Load all model files from this directory
fs.readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && 
           (file !== 'index.js') && 
           (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Set up associations between models
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
