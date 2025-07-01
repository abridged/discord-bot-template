#!/usr/bin/env node

/**
 * Debug script to simulate the exact /mother command flow
 * This will help us understand what happens during actual quiz submission
 */

require('dotenv').config();

console.log('🔥 SCRIPT STARTING - TOP LEVEL');
console.log('🔍 DEBUGGING Real Quiz Submission Flow');
console.log('======================================');

async function testRealSubmissionFlow() {
  console.log('🚀 ENTERING testRealSubmissionFlow function');
  
  try {
    console.log('🚀 ENTERING main try block');
    
    // Import the exact same services used by the /mother command
    const { createBlockchainService } = require('./src/services/blockchain');
    const { saveQuiz } = require('./src/services/storage');
    
    console.log('\n🔧 Step 1: Initialize blockchain service (same as real flow)');
    console.log('🚀 EXECUTING Step 1');
    const blockchainService = createBlockchainService();
    
    console.log('- Service type:', blockchainService.constructor.name);
    console.log('- quizService.contractsAvailable:', blockchainService.quizService.contractsAvailable);
    console.log('- quizService.motherFactoryAddress:', blockchainService.quizService.motherFactoryAddress);
    
    console.log('\n🔧 Step 2: Simulate quiz data (same format as motherQuizHandler)');
    console.log('🚀 EXECUTING Step 2');
    const quizData = {
      id: `quiz_${Date.now()}_test_user`,
      quizId: `quiz_${Date.now()}_test_user`,
      creator: 'test_user_id',
      creatorDiscordId: 'test_user_id',
      creatorWalletAddress: '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee', // Use bot wallet for testing
      sourceUrl: 'https://example.com/test',
      url: 'https://example.com/test',
      fundingAmount: '1000000000000000000', // 1 ETH in wei
      chainId: 84532, // Base Sepolia
      tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
      rewardAmount: '1000000000000000000',
      difficulty: 'medium',
      questionCount: 0,
      questions: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      rewardsDistribution: {
        correct: 75,
        incorrect: 25
      }
    };
    
    console.log('🚀 ABOUT TO START Step 3');
    console.log('\n🔧 Step 3: Test direct submitQuiz call');
    console.log('🚀 EXECUTING Step 3');
    console.log('🔍 STEP3 DEBUG: About to attempt direct submitQuiz call');
    console.log('🔍 STEP3 DEBUG: blockchainService type:', typeof blockchainService);
    console.log('🔍 STEP3 DEBUG: blockchainService.submitQuiz type:', typeof blockchainService.submitQuiz);
    
    const userWallet = '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee'; // Bot wallet for testing
    
    console.log('- Calling blockchainService.submitQuiz directly...');
    console.log('🔍 STEP3 DEBUG: userWallet =', userWallet);
    console.log('🔍 STEP3 DEBUG: quizData.id =', quizData.id);
    
    try {
      console.log('🔍 STEP3 DEBUG: Entering submitQuiz try block');
      const result = await blockchainService.submitQuiz(
        quizData, 
        userWallet, 
        'test_user_id'
      );
      console.log('🔍 STEP3 DEBUG: submitQuiz returned without error');
      
      console.log('\n✅ SUCCESS: submitQuiz completed successfully!');
      console.log('- Result:', JSON.stringify(result, null, 2));
    } catch (submitError) {
      console.error('\n❌ ERROR in direct submitQuiz call:', submitError.message);
      console.error('- Full submitQuiz error:', submitError);
      console.error('- Stack trace:', submitError.stack);
      console.error('🔍 STEP3 DEBUG: Caught error in inner try-catch');
    }
    
    console.log('🚀 COMPLETED Step 3');
    console.log('🚀 ABOUT TO START Step 4');
    console.log('\n🔧 Step 4: Test full saveQuiz flow (same as storage service)');
    console.log('🚀 EXECUTING Step 4');
    console.log('- Calling saveQuiz with blockchain submission...');
    
    const savedQuizId = await saveQuiz(quizData, userWallet);
    
    console.log('\n✅ SUCCESS: saveQuiz completed successfully!');
    console.log('- Saved quiz ID:', savedQuizId);
    
  } catch (error) {
    console.error('\n❌ ERROR in submission flow:', error.message);
    console.error('- Full error:', error);
    
    // Check if it's the validation error we expect
    if (error.message.includes('contracts are not deployed')) {
      console.error('\n🎯 CONFIRMED: This is the validation error blocking quiz creation!');
      console.error('   The validation check is incorrectly detecting contracts as unavailable.');
    }
  }
}

// Run the test
testRealSubmissionFlow().then(() => {
  console.log('\n🎯 DEBUGGING COMPLETE');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 FATAL ERROR:', error);
  process.exit(1);
});
