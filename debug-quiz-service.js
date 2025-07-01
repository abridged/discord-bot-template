#!/usr/bin/env node

/**
 * Debug script to test QuizService initialization
 * This will help us understand why contractsAvailable is false
 */

// Load environment variables
require('dotenv').config();

console.log('🔍 DEBUGGING QuizService Initialization');
console.log('=====================================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('- USE_REAL_BLOCKCHAIN:', process.env.USE_REAL_BLOCKCHAIN);
console.log('- MOTHER_FACTORY_ADDRESS:', process.env.MOTHER_FACTORY_ADDRESS);
console.log('- QUIZ_HANDLER_ADDRESS:', process.env.QUIZ_HANDLER_ADDRESS);
console.log('- BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('- DEPLOYMENT_PK present:', !!process.env.DEPLOYMENT_PK);

// Test QuizService initialization
console.log('\n🔧 Testing QuizService Initialization:');

try {
  const { QuizService } = require('./src/services/blockchain/quizService');
  
  console.log('✅ QuizService imported successfully');
  
  // Initialize QuizService
  const quizService = new QuizService();
  
  console.log('\n📊 QuizService State:');
  console.log('- contractsAvailable:', quizService.contractsAvailable);
  console.log('- motherFactoryAddress:', quizService.motherFactoryAddress);
  console.log('- quizHandlerAddress:', quizService.quizHandlerAddress);
  console.log('- useRealBlockchain:', quizService.useRealBlockchain);
  console.log('- provider available:', !!quizService.provider);
  console.log('- signer available:', !!quizService.signer);
  console.log('- motherFactory contract:', !!quizService.motherFactory);
  console.log('- quizHandler contract:', !!quizService.quizHandler);
  
  if (quizService.contractsAvailable) {
    console.log('\n✅ SUCCESS: QuizService initialized with contracts available!');
  } else {
    console.log('\n❌ PROBLEM: QuizService contractsAvailable is false');
    console.log('   This explains why QuizEscrow deployment is failing');
  }
  
} catch (error) {
  console.error('\n❌ ERROR initializing QuizService:', error.message);
  console.error('Stack trace:', error.stack);
}

// Test RealBlockchainService initialization
console.log('\n🔧 Testing RealBlockchainService Initialization:');

try {
  const { createBlockchainService } = require('./src/services/blockchain');
  
  console.log('✅ Blockchain service factory imported successfully');
  
  // Create blockchain service
  const blockchainService = createBlockchainService();
  
  console.log('\n📊 BlockchainService State:');
  console.log('- Service type:', blockchainService.constructor.name);
  console.log('- quizService available:', !!blockchainService.quizService);
  
  if (blockchainService.quizService) {
    console.log('- quizService.contractsAvailable:', blockchainService.quizService.contractsAvailable);
    console.log('- quizService.motherFactoryAddress:', blockchainService.quizService.motherFactoryAddress);
    console.log('- quizService.quizHandlerAddress:', blockchainService.quizService.quizHandlerAddress);
  }
  
} catch (error) {
  console.error('\n❌ ERROR initializing BlockchainService:', error.message);
  console.error('Stack trace:', error.stack);
}

console.log('\n🎯 CONCLUSION:');
console.log('If contractsAvailable is false, this explains why the `/mother` command');
console.log('fails during QuizEscrow deployment in the submitQuiz validation check.');
