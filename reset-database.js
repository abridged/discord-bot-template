/**
 * Reset database script
 * Clears all quiz data while preserving other data
 */

const { sequelize } = require('./src/database');

async function resetDatabase() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connection established. Clearing quiz data...');
    
    // Reset quiz-related tables
    console.log('Truncating Quizzes table...');
    await sequelize.query('DELETE FROM Quizzes');
    
    console.log('Truncating Questions table...');
    await sequelize.query('DELETE FROM Questions');
    
    console.log('Truncating Answers table...');
    await sequelize.query('DELETE FROM Answers');
    
    console.log('Database reset complete! All quiz data has been cleared.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

// Run the reset function
resetDatabase();
