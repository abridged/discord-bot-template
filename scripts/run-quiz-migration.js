const { Sequelize } = require('sequelize');
const path = require('path');

async function runMigration() {
  try {
    // Initialize quiz database connection
    const quizSequelize = new Sequelize({
      dialect: 'sqlite',
      storage: path.join(__dirname, '../db/quiz_tracking.sqlite'),
      logging: false
    });

    // Test connection
    await quizSequelize.authenticate();
    console.log('✅ Connected to quiz tracking database');

    // Import and run migration
    const migration = require('../src/quizDatabase/migrations/01-add-wallet-addresses');
    
    console.log('🔄 Running migration: Add wallet addresses to quiz tables...');
    await migration.up(quizSequelize.getQueryInterface(), Sequelize);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    console.log('\n📋 Verifying database schema...');
    
    const attemptColumns = await quizSequelize.getQueryInterface().describeTable('QuizAttempts');
    const completionColumns = await quizSequelize.getQueryInterface().describeTable('QuizCompletions');
    
    console.log('\nQuizAttempts table columns:');
    Object.keys(attemptColumns).forEach(col => {
      console.log(`  - ${col}: ${attemptColumns[col].type}`);
    });
    
    console.log('\nQuizCompletions table columns:');
    Object.keys(completionColumns).forEach(col => {
      console.log(`  - ${col}: ${completionColumns[col].type}`);
    });
    
    await quizSequelize.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 