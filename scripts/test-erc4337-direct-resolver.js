/**
 * Test ERC-4337 Direct Resolver
 * 
 * Tests the corrected ERC-4337 user operation resolution that bypasses
 * the SDK parameter mismatch issue by making direct API calls with
 * proper query parameters.
 */

const { ERC4337DirectResolver } = require('../src/services/blockchain/erc4337DirectResolver');

async function testDirectResolver() {
  console.log('🚀 Testing ERC-4337 Direct Resolver');
  console.log('===================================');
  
  // Test configuration
  const testUserOpHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
  const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS || '0x85ef58b83366381122d341Dbc9B6689236060aa0';
  
  console.log(`🎯 Test UserOp Hash: ${testUserOpHash}`);
  console.log(`🏭 MotherFactory Address: ${motherFactoryAddress}`);
  console.log();
  
  try {
    // Initialize Direct Resolver
    console.log('🔧 Initializing ERC-4337 Direct Resolver...');
    const resolver = new ERC4337DirectResolver({
      maxRetries: 2,
      retryDelay: 2000
    });
    
    // Test 1: Get user operation receipt with corrected API call
    console.log('📡 Test 1: Getting user operation receipt...');
    console.log('=' .repeat(50));
    
    const receiptResult = await resolver.getUserOperationReceipt(testUserOpHash);
    
    if (receiptResult.success) {
      console.log('✅ SUCCESS: User operation receipt retrieved!');
      console.log(`📊 Resolved at: ${receiptResult.resolvedAt}`);
      console.log(`🔄 Attempts: ${receiptResult.attempt}`);
      console.log();
      
      // Test 2: Extract transaction data from receipt
      console.log('📋 Test 2: Extracting transaction data...');
      console.log('=' .repeat(50));
      
      const transactionData = resolver.extractTransactionFromReceipt(receiptResult.receipt);
      
      if (transactionData) {
        console.log('✅ SUCCESS: Transaction data extracted!');
        console.log(`🔗 Transaction Hash: ${transactionData.transactionHash}`);
        console.log(`📋 Logs Count: ${transactionData.logs.length}`);
        console.log(`🧱 Block Number: ${transactionData.blockNumber}`);
        console.log(`⛽ Gas Used: ${transactionData.gasUsed}`);
        console.log();
        
        // Test 3: Extract QuizEscrow deployment events
        console.log('🏗️  Test 3: Extracting QuizEscrow deployment events...');
        console.log('=' .repeat(50));
        
        const escrowEvents = resolver.extractQuizEscrowEvents(transactionData.logs, motherFactoryAddress);
        
        if (escrowEvents.length > 0) {
          console.log(`✅ SUCCESS: Found ${escrowEvents.length} QuizEscrow deployment events!`);
          
          escrowEvents.forEach((event, index) => {
            console.log(`📦 Event ${index + 1}:`);
            console.log(`   🏠 Escrow Address: ${event.escrowAddress}`);
            console.log(`   👤 Creator: ${event.creator}`);
            console.log(`   💰 Deployment Fee: ${event.deploymentFee} wei`);
            console.log(`   📍 Log Index: ${event.logIndex}`);
          });
          console.log();
          
          // Test 4: Complete end-to-end resolution
          console.log('🎯 Test 4: Complete userOp → escrow address resolution...');
          console.log('=' .repeat(50));
          
          const completeResult = await resolver.resolveUserOpToEscrowAddress(
            testUserOpHash,
            motherFactoryAddress
          );
          
          if (completeResult.success) {
            console.log('🎉 COMPLETE SUCCESS: ERC-4337 userOp → escrow address resolved!');
            console.log(`🎯 UserOp Hash: ${completeResult.userOpHash}`);
            console.log(`🔗 Actual Transaction: ${completeResult.actualTransactionHash}`);
            console.log(`🏠 Escrow Address: ${completeResult.escrowAddress}`);
            console.log(`👤 Creator: ${completeResult.escrowEvent.creator}`);
            console.log(`💰 Deployment Fee: ${completeResult.escrowEvent.deploymentFee} wei`);
            console.log(`⏰ Resolved At: ${completeResult.resolvedAt}`);
            
            return {
              success: true,
              message: 'ERC-4337 Direct Resolver working perfectly!',
              result: completeResult
            };
          } else {
            console.log('❌ Complete resolution failed:', completeResult.error);
            return {
              success: false,
              message: 'Complete resolution failed',
              error: completeResult.error,
              details: completeResult
            };
          }
          
        } else {
          console.log('❌ No QuizEscrow deployment events found');
          return {
            success: false,
            message: 'No QuizEscrow deployment events found',
            transactionData
          };
        }
        
      } else {
        console.log('❌ Failed to extract transaction data from receipt');
        return {
          success: false,
          message: 'Failed to extract transaction data',
          receipt: receiptResult.receipt
        };
      }
      
    } else {
      console.log('❌ Failed to get user operation receipt:', receiptResult.error);
      return {
        success: false,
        message: 'Failed to get user operation receipt',
        error: receiptResult.error,
        details: receiptResult
      };
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return {
      success: false,
      message: 'Test failed with exception',
      error: error.message,
      stack: error.stack
    };
  }
}

async function main() {
  console.log('🎯 ERC-4337 Direct Resolver Test Suite');
  console.log('=====================================');
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log();
  
  const result = await testDirectResolver();
  
  console.log();
  console.log('📊 Final Test Result:');
  console.log('====================');
  
  if (result.success) {
    console.log('✅ SUCCESS: ERC-4337 Direct Resolver is working!');
    console.log(`🎉 ${result.message}`);
    
    if (result.result && result.result.escrowAddress) {
      console.log();
      console.log('🏆 KEY ACHIEVEMENT:');
      console.log(`   UserOp Hash: ${result.result.userOpHash}`);
      console.log(`   → Escrow Address: ${result.result.escrowAddress}`);
      console.log('   This resolution is now ready for bot integration!');
    }
  } else {
    console.log('❌ FAILED: ERC-4337 Direct Resolver needs debugging');
    console.log(`💥 ${result.message}`);
    
    if (result.error) {
      console.log(`🔍 Error: ${result.error}`);
    }
  }
  
  console.log();
  console.log('🎯 ERC-4337 Direct Resolver test completed');
}

// Run the test
main().catch(console.error);
