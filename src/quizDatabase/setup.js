const { quizSequelize, initializeQuizDatabase, setupModels } = require('./index');

// Setup the quiz tracking database
async function setupQuizDatabase() {
  try {
    // Initialize database connection
    const dbConnected = await initializeQuizDatabase();
    
    if (!dbConnected) {
      console.error('Failed to connect to quiz tracking database');
      return false;
    }
    
    console.log('Setting up quiz tracking database...');
    
    // Initialize models and create tables
    const db = await setupModels();
    
    // Check if tables were created successfully
    try {
      const tables = await quizSequelize.getQueryInterface().showAllTables();
      console.log('\nQuiz tracking database tables:');
      tables.forEach(table => console.log(`- ${table}`));
      
      return true;
    } catch (error) {
      console.error('Error checking quiz database tables:', error);
      return false;
    }
  } catch (error) {
    console.error('Quiz database setup error:', error);
    return false;
  }
}

module.exports = {
  setupQuizDatabase
};
