/**
 * Quiz Database Check Script
 * 
 * This script shows recent quizzes and their blockchain status
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRecentQuizzes() {
  try {
    console.log('============== RECENT QUIZZES ==============');
    
    const quizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        questions: true
      }
    });
    
    if (quizzes.length === 0) {
      console.log('No quizzes found in the database.');
      return;
    }
    
    quizzes.forEach((quiz, index) => {
      console.log(`\n----- QUIZ ${index + 1} -----`);
      console.log(`ID: ${quiz.id}`);
      console.log(`Title: ${quiz.title || 'No title'}`);
      console.log(`Created: ${new Date(quiz.createdAt).toLocaleString()}`);
      console.log(`Questions: ${quiz.questions ? quiz.questions.length : 0}`);
      console.log(`Token: ${quiz.tokenAddress}`);
      console.log(`Amount: ${quiz.rewardAmount}`);
      console.log(`Funding Status: ${quiz.fundingStatus || 'Not set'}`);
      console.log(`Escrow Address: ${quiz.escrowAddress || 'Not deployed'}`);
      console.log(`Transaction Hash: ${quiz.fundingTransactionHash || 'None'}`);
    });
    
    console.log('\n----- VERIFICATION INSTRUCTIONS -----');
    console.log('To verify a specific quiz escrow, run:');
    console.log('node scripts/verify-escrow.js QUIZ_ID');
    console.log('Replace QUIZ_ID with one of the IDs listed above');
    
    if (quizzes.length > 0 && quizzes[0].id) {
      console.log(`\nFor example, to verify the most recent quiz:`);
      console.log(`node scripts/verify-escrow.js ${quizzes[0].id}`);
    }
    
  } catch (error) {
    console.error('Error retrieving quizzes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
getRecentQuizzes();
