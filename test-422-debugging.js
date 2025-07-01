#!/usr/bin/env node

/**
 * Quick test to trigger 422 error and capture enhanced debugging
 */

const QuizService = require('./src/services/blockchain/quizService');

async function test422Error() {
  console.log('🔍 Testing 422 error with enhanced debugging...');
  
  try {
    const quizService = new QuizService();
    
    // Test parameters that should trigger the 422 error
    const result = await quizService.deployQuizEscrow({
      creator: '0x1234567890123456789012345678901234567890',
      authorizedBot: '0x1234567890123456789012345678901234567890',
      duration: 86400, // 24 hours
      correctReward: '0',
      incorrectReward: '0',
      discordUserId: '12345678901234567890'
    });
    
    console.log('✅ Deployment successful:', result);
  } catch (error) {
    console.error('❌ Expected 422 error caught:', error.message);
    console.log('🔍 Enhanced debugging should have appeared above');
  }
}

test422Error().catch(console.error);
