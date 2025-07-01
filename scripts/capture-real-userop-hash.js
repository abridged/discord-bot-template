#!/usr/bin/env node

/**
 * Script to capture a real userOp hash from /mother command execution
 * This will help us test the ERC-4337 Direct Resolver with actual user operations
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Import services needed for /mother command simulation
const { saveQuiz } = require('../src/services/storage');
const RealBlockchainService = require('../src/services/blockchain/realBlockchainService');
const QuizService = require('../src/services/blockchain/quizService');

async function captureRealUserOpHash() {
  console.log('🎯 STARTING REAL USEROP HASH CAPTURE');
  console.log('=====================================');
  
  // Ensure we're in real blockchain mode for this test
  process.env.USE_REAL_BLOCKCHAIN = 'true';
  
  console.log('📋 Environment Check:');
  console.log(`   USE_REAL_BLOCKCHAIN: ${process.env.USE_REAL_BLOCKCHAIN}`);
  console.log(`   MOTHER_FACTORY_ADDRESS: ${process.env.MOTHER_FACTORY_ADDRESS}`);
  console.log(`   QUIZ_HANDLER_ADDRESS: ${process.env.QUIZ_HANDLER_ADDRESS}`);
  console.log(`   Chain ID: ${process.env.DEFAULT_CHAIN_ID}`);
  console.log('');
  
  try {
    // Step 1: Initialize services
    console.log('🔧 Step 1: Initializing services...');
    const quizService = new QuizService();
    const blockchainService = new RealBlockchainService(quizService);
    
    // Step 2: Create test quiz data (simulating /mother command input)
    console.log('🔧 Step 2: Creating test quiz data...');
    const testQuizData = {
      id: `test-quiz-${Date.now()}`,
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2, // Paris
      rewardAmount: ethers.utils.parseEther('0.001').toString(), // 0.001 ETH total
      tokenAddress: process.env.DEFAULT_TOKEN_ADDRESS || ethers.constants.AddressZero,
      chainId: parseInt(process.env.DEFAULT_CHAIN_ID) || 84532,
      creatorDiscordId: '123456789012345678' // Test Discord user ID
    };
    
    console.log('📊 Test Quiz Data:', JSON.stringify(testQuizData, null, 2));
    console.log('');
    
    // Step 3: Execute the quiz submission (this will trigger Account Kit deployment)
    console.log('🚀 Step 3: Executing quiz submission (this will call Account Kit)...');
    console.log('⏳ This may take 30-60 seconds as it involves real blockchain transactions...');
    console.log('');
    
    // This will trigger the entire /mother command flow and capture the userOp hash
    const result = await blockchainService.submitQuiz(
      testQuizData,
      null, // userWallet (will be resolved from Discord ID)
      testQuizData.creatorDiscordId
    );
    
    console.log('✅ Step 4: Quiz submission completed!');
    console.log('📊 Submission Result:', JSON.stringify(result, null, 2));
    console.log('');
    
    // Step 4: Look for captured userOp hash in the logs above
    console.log('🔍 Step 5: Check the logs above for the captured userOp hash!');
    console.log('   Look for: "📋 CAPTURED USEROP HASH: 0x..."');
    console.log('');
    
    if (result.status === 'success' && result.transactionHash) {
      console.log('🎉 SUCCESS! Real blockchain deployment completed.');
      console.log(`   Transaction Hash: ${result.transactionHash}`);
      console.log(`   Escrow Address: ${result.escrowAddress || 'N/A'}`);
      
      // Step 5: Test our ERC-4337 Direct Resolver with the captured hash
      console.log('');
      console.log('🧪 Step 6: Testing ERC-4337 Direct Resolver with captured userOp hash...');
      
      // Note: The userOp hash should be visible in the logs above from our instrumentation
      console.log('📝 To test the ERC-4337 Direct Resolver:');
      console.log('   1. Copy the userOp hash from the logs above');
      console.log('   2. Run: node scripts/test-erc4337-direct-resolver.js <userOpHash>');
      console.log('   3. This will test our resolver with a REAL user operation');
      
    } else {
      console.log('⚠️  Deployment may have failed or is in development mode');
      console.log('   Check the logs above for userOp hash capture');
    }
    
  } catch (error) {
    console.error('❌ Error during userOp hash capture:', error);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('');
  console.log('🏁 Real UserOp Hash Capture Complete');
  console.log('=====================================');
}

// Execute if run directly
if (require.main === module) {
  captureRealUserOpHash().catch(console.error);
}

module.exports = { captureRealUserOpHash };
