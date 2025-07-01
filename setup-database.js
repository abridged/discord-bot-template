// Database setup script
require('dotenv').config();
const { setupDatabase } = require('./src/database/setup');
const { sequelize } = require('./src/database/index');
const models = require('./src/database/models');

async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
    
    // Run the setup function which includes migrations
    const success = await setupDatabase();
    
    if (!success) {
      console.error('Database setup failed!');
      process.exit(1);
    }
    
    console.log('Database setup completed successfully!');
    console.log('Checking database tables...');
    
    // List all tables in the database
    try {
      const tables = await sequelize.getQueryInterface().showAllTables();
      console.log('\nDatabase tables:');
      tables.forEach(table => console.log(`- ${table}`));
      
      // Create a test quiz if no quizzes exist
      const quizCount = await models.Quiz.count();
      console.log(`\nTotal quizzes in database: ${quizCount}`);
      
      if (quizCount === 0) {
        console.log('\nCreating a sample quiz for testing...');
        
        const sampleQuiz = await models.Quiz.create({
          creatorDiscordId: '123456789012345678', // Replace with a real Discord ID if needed
          sourceUrl: 'https://example.com/test-article',
          difficulty: 'medium',
          questionCount: 3,
          tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1', // Default token from your project memory
          chainId: 8453, // Base chain from your project memory
          rewardAmount: '10000',
          expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
          fundingStatus: 'funded'
        });
        
        // Create some sample questions
        await models.Question.bulkCreate([
          {
            quizId: sampleQuiz.id,
            questionText: 'What is the main benefit of blockchain technology?',
            options: JSON.stringify([
              'Immutable record keeping',
              'Fast transaction processing',
              'Low energy consumption',
              'Easy to program'
            ]),
            correctOptionIndex: 0
          },
          {
            quizId: sampleQuiz.id,
            questionText: 'What percentage of rewards go to correct answers in this system?',
            options: JSON.stringify([
              '50%',
              '75%',
              '90%',
              '100%'
            ]),
            correctOptionIndex: 1
          },
          {
            quizId: sampleQuiz.id,
            questionText: 'When do quizzes expire by default?',
            options: JSON.stringify([
              'End of the current day',
              'End of the next day UTC',
              'After 48 hours',
              'After one week'
            ]),
            correctOptionIndex: 1
          }
        ]);
        
        console.log(`Sample quiz created with ID: ${sampleQuiz.id}`);
      }
      
    } catch (error) {
      console.error('Error checking database tables:', error);
    }
    
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the initialization
initializeDatabase();
