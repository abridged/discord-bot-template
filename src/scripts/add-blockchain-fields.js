/**
 * Manual migration script to add blockchain fields to the quiz and answer tables
 */

const { Sequelize, DataTypes } = require('sequelize');
const { setupDatabase } = require('../database/setup');
const models = require('../database/models');

async function runMigration() {
  try {
    // Initialize the database
    console.log('Initializing database...');
    await setupDatabase();
    
    // Get the Quiz model
    const Quiz = models.Quiz;
    const Answer = models.Answer;
    
    // Check if fields already exist
    console.log('Checking current schema...');
    const quizAttributes = Object.keys(Quiz.rawAttributes);
    const answerAttributes = Object.keys(Answer.rawAttributes);
    
    console.log('Current Quiz attributes:', quizAttributes);
    console.log('Current Answer attributes:', answerAttributes);
    
    // Add fields to Quiz model if they don't exist
    const queryInterface = Quiz.sequelize.getQueryInterface();
    
    if (!quizAttributes.includes('escrowAddress')) {
      console.log('Adding escrowAddress to Quiz model...');
      await queryInterface.addColumn('quizzes', 'escrowAddress', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
    
    if (!quizAttributes.includes('transactionHash')) {
      console.log('Adding transactionHash to Quiz model...');
      await queryInterface.addColumn('quizzes', 'transactionHash', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
    
    if (!quizAttributes.includes('onChain')) {
      console.log('Adding onChain to Quiz model...');
      await queryInterface.addColumn('quizzes', 'onChain', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    
    if (!quizAttributes.includes('expiryTime')) {
      console.log('Adding expiryTime to Quiz model...');
      await queryInterface.addColumn('quizzes', 'expiryTime', {
        type: DataTypes.BIGINT,
        allowNull: true
      });
    }
    
    // Add fields to Answer model if they don't exist
    if (!answerAttributes.includes('onChain')) {
      console.log('Adding onChain to Answer model...');
      await queryInterface.addColumn('answers', 'onChain', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    
    console.log('Migration completed successfully!');
    
    // Close the database connection
    await Quiz.sequelize.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

// Run the migration
runMigration();
