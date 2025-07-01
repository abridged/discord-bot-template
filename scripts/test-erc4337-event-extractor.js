const { ERC4337UserOpEventExtractor } = require('../src/services/blockchain/erc4337UserOpEventExtractor');
require('dotenv').config();

async function testERC4337EventExtractor() {
  console.log('🧪 TESTING ERC-4337 USER OPERATION EVENT EXTRACTOR');
  console.log('=================================================');
  
  try {
    // Initialize the extractor
    const extractor = new ERC4337UserOpEventExtractor({
      maxRetries: 2,
      retryDelay: 2000
    });
    
    // Test data from our previous deployment
    const userOpHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    const expectedCreator = '0x3c7c0ebFCD5786ef48df5ed127cdDEb806db976d';
    const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS;
    
    console.log(`🎯 UserOp Hash: ${userOpHash}`);
    console.log(`👤 Expected Creator: ${expectedCreator}`);
    console.log(`🏭 MotherFactory: ${motherFactoryAddress}`);
    
    // Test 1: User operation receipt extraction using Account Kit SDK
    console.log('\n📋 TEST 1: Account Kit SDK user operation receipt extraction');
    console.log('========================================================');
    
    const receiptResult = await extractor.getUserOperationReceipt(userOpHash);
    
    console.log('\n📊 Receipt Result:');
    console.log('==================');
    console.log(JSON.stringify(receiptResult, null, 2));
    
    if (receiptResult.success) {
      console.log('✅ User operation receipt extraction SUCCESS with Account Kit SDK!');
      
      // Test 2: Transaction data extraction
      console.log('\n📋 TEST 2: Transaction data extraction');
      console.log('====================================');
      
      const transactionData = extractor.extractTransactionFromReceipt(receiptResult.receipt);
      
      if (transactionData) {
        console.log('✅ Transaction data extraction SUCCESS!');
        console.log(`🔗 Actual Transaction Hash: ${transactionData.transactionHash}`);
        console.log(`📋 Block Number: ${transactionData.blockNumber}`);
        console.log(`📋 Status: ${transactionData.status}`);
        console.log(`📋 Logs Count: ${transactionData.logs?.length || 0}`);
        
        // Test 3: QuizEscrow event extraction
        if (transactionData.logs && transactionData.logs.length > 0) {
          console.log('\n📋 TEST 3: QuizEscrow deployment event extraction');
          console.log('===============================================');
          
          const escrowEvents = extractor.extractQuizEscrowDeploymentEvents(
            transactionData.logs, 
            motherFactoryAddress
          );
          
          console.log(`✅ Found ${escrowEvents.length} QuizEscrow deployment events`);
          
          escrowEvents.forEach((event, index) => {
            console.log(`\n🎯 Escrow Event ${index + 1}:`);
            console.log(`   Escrow Address: ${event.escrowAddress}`);
            console.log(`   Contract Type: ${event.contractType}`);
            console.log(`   Creator: ${event.creator}`);
            console.log(`   Deployment Fee: ${event.deploymentFee} wei`);
            console.log(`   Log Index: ${event.logIndex}`);
            
            // Validate creator
            if (expectedCreator && event.creator.toLowerCase() === expectedCreator.toLowerCase()) {
              console.log('   ✅ Creator matches expected value!');
            }
          });
          
        } else {
          console.log('⚠️  No logs found in transaction data');
        }
        
      } else {
        console.log('❌ Transaction data extraction FAILED');
      }
      
    } else {
      console.log('❌ User operation receipt extraction FAILED');
      console.log(`❌ Error: ${receiptResult.error}`);
    }
    
    // Test 4: Complete resolution (userOp → escrow address)
    console.log('\n📋 TEST 4: Complete userOp → escrow address resolution');
    console.log('====================================================');
    
    const completeResult = await extractor.resolveUserOpToEscrowAddress(
      userOpHash,
      motherFactoryAddress,
      expectedCreator
    );
    
    console.log('\n📊 Complete Resolution Result:');
    console.log('=============================');
    
    if (completeResult.success) {
      console.log('🎉 COMPLETE RESOLUTION SUCCESS!');
      console.log(`🔗 UserOp Hash: ${completeResult.userOpHash}`);
      console.log(`🔗 Actual Transaction Hash: ${completeResult.actualTransactionHash}`);
      console.log(`🎯 ESCROW ADDRESS: ${completeResult.escrowAddress}`);
      console.log(`👤 Creator: ${completeResult.escrowEvent.creator}`);
      console.log(`💰 Deployment Fee: ${completeResult.escrowEvent.deploymentFee} wei`);
      
      // Show summary for database update
      console.log('\n🗃️  DATABASE UPDATE DATA:');
      console.log('========================');
      console.log(`escrowAddress: "${completeResult.escrowAddress}"`);
      console.log(`actualTransactionHash: "${completeResult.actualTransactionHash}"`);
      console.log(`deploymentFee: "${completeResult.escrowEvent.deploymentFee}"`);
      console.log(`resolvedAt: "${completeResult.resolvedAt}"`);
      
    } else {
      console.log('❌ Complete resolution FAILED');
      console.log(`❌ Error: ${completeResult.error}`);
      
      if (completeResult.actualTransactionHash) {
        console.log(`🔗 Transaction Hash: ${completeResult.actualTransactionHash}`);
      }
      
      // Show details for debugging
      console.log('\n🔍 Resolution Details:');
      console.log('=====================');
      console.log(JSON.stringify(completeResult, null, 2));
    }
    
    // Test 5: Performance test (if first test succeeded)
    if (receiptResult.success) {
      console.log('\n📋 TEST 5: Performance test (multiple resolutions)');
      console.log('=================================================');
      
      const startTime = Date.now();
      
      const performanceResults = await Promise.all([
        extractor.getUserOperationReceipt(userOpHash),
        extractor.getUserOperationReceipt(userOpHash),
        extractor.getUserOperationReceipt(userOpHash)
      ]);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const successCount = performanceResults.filter(r => r.success).length;
      console.log(`✅ Performance test: ${successCount}/3 successes in ${duration}ms`);
      console.log(`⚡ Average time per resolution: ${duration / 3}ms`);
    }
    
  } catch (error) {
    console.error('💥 TEST SCRIPT ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testERC4337EventExtractor()
  .then(() => {
    console.log('\n🎉 ERC-4337 Event Extractor test completed');
  })
  .catch((error) => {
    console.error('💥 Test script error:', error);
  });
