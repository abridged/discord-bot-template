const { AccountKitEventExtractor } = require('../src/services/blockchain/accountKitEventExtractor');
require('dotenv').config();

async function testAccountKitEventExtraction() {
  console.log('🧪 TESTING ACCOUNT KIT EVENT EXTRACTION');
  console.log('======================================');
  
  try {
    // Initialize the extractor
    const extractor = new AccountKitEventExtractor({
      motherFactoryAddress: process.env.MOTHER_FACTORY_ADDRESS,
      maxRetries: 2,
      retryDelay: 2000
    });
    
    console.log(`🏭 MotherFactory Address: ${process.env.MOTHER_FACTORY_ADDRESS}`);
    
    // Test with our real user operation hash
    const userOpHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    const expectedCreator = '0x3c7c0ebFCD5786ef48df5ed127cdDEb806db976d'; // User's smart account
    
    console.log(`🎯 Testing UserOp Hash: ${userOpHash}`);
    console.log(`👤 Expected Creator: ${expectedCreator}`);
    console.log(`📋 This is an ERC-4337 user operation hash, NOT an EOA transaction hash`);
    
    // Test the extraction
    console.log('\n🚀 Starting Account Kit-based event extraction...');
    console.log('================================================');
    
    const result = await extractor.extractEscrowFromUserOp(
      userOpHash,
      expectedCreator,
      'QuizEscrow'
    );
    
    console.log('\n📊 EXTRACTION RESULT:');
    console.log('====================');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCCESS: Account Kit event extraction worked!');
      console.log(`🎉 Escrow Address: ${result.escrowAddress}`);
      console.log(`🔗 UserOp Hash: ${result.userOpHash}`);
      console.log(`🔗 Actual Transaction Hash: ${result.actualTransactionHash}`);
      console.log(`📅 Resolved At: ${result.resolvedAt}`);
      
      // Verify the escrow address format
      if (result.escrowAddress && result.escrowAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.log('✅ Escrow address format is valid');
      } else {
        console.log('❌ Escrow address format is invalid');
      }
      
    } else {
      console.log('\n❌ FAILURE: Account Kit event extraction failed');
      console.log(`❌ Error: ${result.error}`);
      console.log(`🔄 Attempts: ${result.attempts}`);
      
      // Analyze the failure
      if (result.error.includes('user operation')) {
        console.log('💡 Analysis: Issue with user operation receipt retrieval');
      } else if (result.error.includes('transaction data')) {
        console.log('💡 Analysis: Issue with extracting transaction from userOp receipt');
      } else if (result.error.includes('event')) {
        console.log('💡 Analysis: Issue with parsing ContractDeployed event');
      }
    }
    
    // Test async extraction method
    console.log('\n🔄 Testing async extraction method...');
    console.log('====================================');
    
    let asyncResult = null;
    
    await extractor.extractAsync(
      userOpHash,
      expectedCreator,
      async (successData) => {
        console.log('✅ Async extraction SUCCESS callback triggered');
        asyncResult = { success: true, data: successData };
      },
      async (failureData) => {
        console.log('❌ Async extraction FAILURE callback triggered');
        asyncResult = { success: false, data: failureData };
      }
    );
    
    if (asyncResult) {
      console.log('📊 Async Result:', JSON.stringify(asyncResult, null, 2));
    } else {
      console.log('⚠️  Async extraction completed but no callback was triggered');
    }
    
  } catch (error) {
    console.error('💥 TEST SCRIPT ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testAccountKitEventExtraction()
  .then(() => {
    console.log('\n🎉 Account Kit event extraction test completed');
  })
  .catch((error) => {
    console.error('💥 Test script error:', error);
  });
