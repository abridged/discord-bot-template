#!/usr/bin/env node

/**
 * Live UserOp Deployment Debug Test
 * 
 * Directly calls the QuizService.deployQuizEscrow with real parameters
 * to capture the actual Account Kit 400 error in production mode.
 */

require('dotenv').config();
const QuizService = require('./src/services/blockchain/quizService');

async function testLiveDeployment() {
  console.log(' LIVE DEPLOYMENT DEBUG TEST');
  console.log('='.repeat(60));
  
  try {
    // Initialize QuizService in production mode
    const quizService = new QuizService();
    
    console.log(' QuizService initialized');
    console.log(` Real blockchain mode: ${quizService.useRealBlockchain}`);
    console.log(` MotherFactory address: ${quizService.motherFactoryAddress}`);
    
    // Test deployment parameters (realistic values)
    const testParams = {
      creator: '0x9Eb326F637f84222A0d7a7797f5808ae73A416fe', // Valid checksummed test address
      authorizedBot: '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee', // Bot address
      duration: 86400, // 24 hours
      correctReward: '1000000000000000', // 0.001 ETH in wei
      incorrectReward: '500000000000000', // 0.0005 ETH in wei  
      discordUserId: '123456789012345678' // Test Discord user ID
    };
    
    console.log(' Testing deployment with parameters:');
    console.log(JSON.stringify(testParams, null, 2));
    console.log('='.repeat(60));
    
    // Call deployQuizEscrow - this should trigger the Account Kit 400 error
    const result = await quizService.deployQuizEscrow(testParams);
    
    console.log(' DEPLOYMENT SUCCESS:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error(' DEPLOYMENT FAILED:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.originalError) {
      console.error('Original error:', error.originalError.message);
    }
    
    console.error('Full error:', error);
  }
}

// Run the test
testLiveDeployment().then(() => {
  console.log(' Live deployment debug test completed');
  process.exit(0);
}).catch((error) => {
  console.error(' Test runner failed:', error);
  process.exit(1);
});
