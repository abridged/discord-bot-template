/**
 * Reset Quiz Databases Script
 * Clears all quiz data from both main database and quiz tracking database
 */

// Import both database connections
const { sequelize } = require('./src/database');
const { quizSequelize } = require('./src/quizDatabase');

async function resetQuizDatabases() {
  try {
    console.log('===== CLEARING MAIN DATABASE QUIZ TABLES =====');
    console.log('Connecting to main database...');
    await sequelize.authenticate();
    console.log('Connection established. Clearing quiz data...');
    
    // Reset main quiz-related tables
    console.log('Truncating Quizzes table...');
    await sequelize.query('DELETE FROM Quizzes');
    
    console.log('Truncating Questions table...');
    await sequelize.query('DELETE FROM Questions');
    
    console.log('Truncating Answers table...');
    await sequelize.query('DELETE FROM Answers');

    console.log('Main database quiz tables cleared!');
    
    // Now clear the quiz tracking database
    console.log('\n===== CLEARING QUIZ TRACKING DATABASE TABLES =====');
    console.log('Connecting to quiz tracking database...');
    await quizSequelize.authenticate();
    console.log('Connection established. Clearing quiz tracking data...');
    
    console.log('Truncating QuizCompletion table...');
    await quizSequelize.query('DELETE FROM QuizCompletions');
    
    console.log('Truncating QuizAnswer table...');
    await quizSequelize.query('DELETE FROM QuizAnswers');
    
    console.log('Truncating QuizAttempt table...');
    await quizSequelize.query('DELETE FROM QuizAttempts');
    
    console.log('\n✅ All quiz databases reset complete! All quiz data has been cleared.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting databases:', error);
    process.exit(1);
  }
}

// Run the reset function
resetQuizDatabases();
