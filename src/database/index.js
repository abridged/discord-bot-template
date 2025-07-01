const { Sequelize } = require('sequelize');
const config = require('./config/config.js');
const fs = require('fs');
const path = require('path');

// Get the configuration based on the environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
const sequelize = new Sequelize(dbConfig);

// Load models
const db = {};

// Load all model files from models directory
fs.readdirSync(path.join(__dirname, 'models'))
  .filter(file => {
    return (file.indexOf('.') !== 0) && 
           (file !== 'index.js') && 
           (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, 'models', file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Set up associations between models
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Initialize DB connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Run migrations
    console.log('Running database migrations...');
    try {
      await sequelize.sync();
      console.log('Database migrations completed successfully');
    } catch (migrationError) {
      console.error('Error running migrations:', migrationError);
    }
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  initializeDatabase,
  Sequelize,
  ...db  // Export all models
};
