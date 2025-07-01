/**
 * List Quizzes Script
 * 
 * This script lists all quizzes in the database with their funding status
 * 
 * Usage: node scripts/list-quizzes.js [limit]
 */

require('dotenv').config();

async function main() {
  const limit = process.argv[2] || 10; // Default to 10 quizzes
  
  console.log('========== LISTING RECENT QUIZZES ==========');
  console.log(`Limit: ${limit}`);

  // Initialize database
  const { sequelize } = require('../src/database');
  const db = require('../src/database/models');

  try {
    // Find recent quizzes
    const quizzes = await db.Quiz.findAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    if (!quizzes || quizzes.length === 0) {
      console.log('No quizzes found in the database');
      process.exit(0);
    }

    console.log(`Found ${quizzes.length} quizzes`);
    console.log('\n----- QUIZ LIST -----');
    
    quizzes.forEach((quiz, index) => {
      console.log(`\n[${index + 1}] Quiz ID: ${quiz.id}`);
      console.log(`Created: ${quiz.createdAt}`);
      console.log(`Creator: ${quiz.creatorDiscordId}`);
      console.log(`Status: ${quiz.fundingStatus}`);
      console.log(`Escrow: ${quiz.escrowAddress || 'Not deployed'}`);
      console.log(`On Chain: ${quiz.onChain ? 'Yes' : 'No'}`);
      
      if (quiz.fundingTransactionHash) {
        console.log(`Funding TX: ${quiz.fundingTransactionHash}`);
      }
    });
  } catch (error) {
    console.error('Error listing quizzes:', error);
  } finally {
    // Close database connection
    await sequelize.close();
  }

  console.log('\n========== LIST COMPLETE ==========');
}

main().catch(console.error);
