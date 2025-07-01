const { EscrowAddressResolver } = require('../src/services/blockchain/escrowAddressResolver');
require('dotenv').config();

async function testEscrowResolver() {
  console.log('🧪 ESCROW ADDRESS RESOLVER TEST');
  console.log('==============================');
  
  try {
    const resolver = new EscrowAddressResolver({
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
      motherFactoryAddress: process.env.MOTHER_FACTORY_ADDRESS,
      maxRetries: 3,
      retryDelay: 3000
    });
    
    console.log(`🏭 MotherFactory: ${process.env.MOTHER_FACTORY_ADDRESS}`);
    
    // Test with the recent transaction hash from our debug runs
    const recentTransactionHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    const expectedCreator = '0x4917e853DC273da5F84362aB9f13eE49775B263c';
    
    console.log(`🔍 Testing transaction: ${recentTransactionHash}`);
    console.log(`👤 Expected creator: ${expectedCreator}`);
    
    // Test escrow address resolution
    console.log('\n📋 TEST: Resolve escrow address with fallback providers');
    console.log('====================================================');
    
    const startTime = Date.now();
    const result = await resolver.resolveEscrowAddress(
      recentTransactionHash,
      expectedCreator,
      'QuizEscrow'
    );
    const endTime = Date.now();
    
    console.log(`⏱️  Resolution completed in ${endTime - startTime}ms`);
    console.log(`📊 Result:`, JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCCESS: Escrow address resolved successfully!');
      console.log(`🎯 Escrow Address: ${result.escrowAddress}`);
      console.log(`🔧 Provider Used: ${result.provider}`);
      console.log(`🔄 Attempts Required: ${result.attempt}`);
      console.log(`📅 Resolved At: ${result.resolvedAt}`);
      
      if (result.eventData) {
        console.log('\n📋 Event Details:');
        console.log(`   🏗️  Contract Type: ${result.eventData.contractType}`);
        console.log(`   👤 Creator: ${result.eventData.creator}`);
        console.log(`   💰 Deployment Fee: ${result.eventData.deploymentFee} wei`);
        console.log(`   📦 Block Number: ${result.eventData.blockNumber}`);
      }
      
    } else {
      console.log('\n❌ FAILED: Could not resolve escrow address');
      console.log(`🚫 Error: ${result.error}`);
      console.log(`🔄 Attempts Made: ${result.attempts}`);
    }
    
    // Test batch resolution (if multiple transactions available)
    console.log('\n📋 TEST: Batch resolution example');
    console.log('=================================');
    
    const transactions = [
      {
        hash: recentTransactionHash,
        creator: expectedCreator,
        contractType: 'QuizEscrow'
      }
    ];
    
    const batchResults = await resolver.resolveMultipleEscrowAddresses(transactions);
    console.log(`📊 Batch results: ${batchResults.length} transactions processed`);
    
    batchResults.forEach((batchResult, index) => {
      console.log(`\n📝 Transaction ${index + 1}:`);
      console.log(`   🧾 Hash: ${batchResult.transactionHash}`);
      console.log(`   ✅ Success: ${batchResult.success}`);
      if (batchResult.success) {
        console.log(`   🎯 Escrow: ${batchResult.escrowAddress}`);
      } else {
        console.log(`   ❌ Error: ${batchResult.error}`);
      }
    });
    
  } catch (error) {
    console.error('❌ ESCROW RESOLVER TEST FAILED:', error);
  }
}

// Run the test
testEscrowResolver()
  .then(() => {
    console.log('\n🎉 Escrow resolver test completed');
  })
  .catch((error) => {
    console.error('💥 Test script error:', error);
  });
