const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize, initializeDatabase } = require('./index');
const models = require('./models');

// Create migration instance
const umzug = new Umzug({
  migrations: { 
    glob: 'src/database/migrations/*.js',
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context.queryInterface, context.Sequelize),
        down: async () => migration.down(context.queryInterface, context.Sequelize),
      };
    },
  },
  context: { queryInterface: sequelize.getQueryInterface(), Sequelize },
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

// Set up database with migrations
const setupDatabase = async () => {
  try {
    // First ensure we can connect to the database
    const connected = await initializeDatabase();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Run all pending migrations
    console.log('Running database migrations...');
    await umzug.up();
    console.log('Database migrations completed successfully');
    
    return true;
  } catch (error) {
    console.error('Database setup failed:', error);
    return false;
  }
};

module.exports = {
  setupDatabase,
  models
};
