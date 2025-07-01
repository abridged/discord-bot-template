/**
 * Database Reset Script
 * 
 * This script drops all tables and re-runs migrations to create a fresh database
 */

const { sequelize } = require('../src/database');
const { setupDatabase } = require('../src/database/setup');

async function resetDatabase() {
  try {
    console.log('============== DATABASE RESET STARTED ==============');
    
    // First, drop all tables
    console.log('Dropping all tables...');
    await sequelize.getQueryInterface().dropAllTables();
    console.log('All tables dropped successfully');
    
    // Then set up the database again (run migrations)
    console.log('Re-creating database tables...');
    const success = await setupDatabase();
    
    if (success) {
      console.log('Database reset completed successfully');
    } else {
      console.error('Database reset failed');
    }
    
    console.log('============== DATABASE RESET COMPLETED ==============');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
    process.exit(0);
  }
}

// Run the reset
resetDatabase();
