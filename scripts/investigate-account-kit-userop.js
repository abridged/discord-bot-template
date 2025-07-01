const { getTransaction, getAccountKitClient } = require('../src/account-kit/sdk');
require('dotenv').config();

async function investigateAccountKitUserOp() {
  console.log('🔍 ACCOUNT KIT USER OPERATION INVESTIGATION');
  console.log('==========================================');
  
  try {
    // Our "transaction hash" is actually a user operation hash
    const userOpHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    
    console.log(`🎯 Investigating UserOp Hash: ${userOpHash}`);
    console.log(`📋 This is NOT an EOA transaction hash - it's an ERC-4337 user operation hash`);
    
    // Test 1: Account Kit's getTransaction method
    console.log('\n📋 TEST 1: Account Kit getTransaction() with userOp hash');
    console.log('=====================================================');
    
    try {
      const txData = await getTransaction(userOpHash);
      console.log(`✅ Account Kit getTransaction() SUCCESS!`);
      console.log(`📊 Transaction Data:`, JSON.stringify(txData, null, 2));
      
      // Look for bundler transaction hash or actual transaction data
      if (txData.actualTransactionHash || txData.bundlerTxHash || txData.executionTxHash) {
        console.log(`🎉 FOUND: Account Kit provides actual transaction hash!`);
        console.log(`🔗 Actual Tx Hash: ${txData.actualTransactionHash || txData.bundlerTxHash || txData.executionTxHash}`);
      }
      
      // Look for transaction receipt data
      if (txData.receipt || txData.logs || txData.events) {
        console.log(`🎉 FOUND: Account Kit provides transaction receipt/events!`);
        console.log(`📋 Receipt/Events:`, txData.receipt || txData.logs || txData.events);
      }
      
    } catch (getTransactionError) {
      console.log(`❌ Account Kit getTransaction() failed:`, getTransactionError.message);
    }
    
    // Test 2: Direct Account Kit client examination
    console.log('\n📋 TEST 2: Account Kit client methods exploration');
    console.log('===============================================');
    
    try {
      const client = getAccountKitClient();
      console.log(`✅ Account Kit client obtained`);
      
      // Log available methods
      if (client.v1) {
        console.log(`📋 V1 methods available:`, Object.keys(client.v1));
      }
      if (client.v2) {
        console.log(`📋 V2 methods available:`, Object.keys(client.v2));
      }
      
      // Look for userOp-specific methods
      const allMethods = [
        ...(client.v1 ? Object.keys(client.v1) : []),
        ...(client.v2 ? Object.keys(client.v2) : [])
      ];
      
      const userOpMethods = allMethods.filter(method => 
        method.toLowerCase().includes('userop') || 
        method.toLowerCase().includes('operation') ||
        method.toLowerCase().includes('bundler') ||
        method.toLowerCase().includes('receipt')
      );
      
      if (userOpMethods.length > 0) {
        console.log(`🎉 FOUND: UserOp-related methods:`, userOpMethods);
      } else {
        console.log(`ℹ️  No obvious userOp-specific methods found`);
      }
      
      // Test specific method if available
      if (client.v2 && typeof client.v2.getUserOperationReceipt === 'function') {
        console.log(`🧪 Testing getUserOperationReceipt...`);
        try {
          const receipt = await client.v2.getUserOperationReceipt(userOpHash);
          console.log(`✅ getUserOperationReceipt SUCCESS:`, JSON.stringify(receipt, null, 2));
        } catch (receiptError) {
          console.log(`❌ getUserOperationReceipt failed:`, receiptError.message);
        }
      }
      
    } catch (clientError) {
      console.log(`❌ Account Kit client error:`, clientError.message);
    }
    
    // Test 3: ERC-4337 bundler transaction resolution
    console.log('\n📋 TEST 3: ERC-4337 bundler transaction analysis');
    console.log('===============================================');
    
    console.log(`🧠 UserOp Hash: ${userOpHash}`);
    console.log(`📝 Analysis:`);
    console.log(`   - This hash represents a user operation, not a transaction`);
    console.log(`   - A bundler executed this userOp in an actual transaction`);
    console.log(`   - The actual transaction (with events) has a different hash`);
    console.log(`   - We need Account Kit to resolve userOp → actual transaction`);
    
  } catch (error) {
    console.error('❌ ACCOUNT KIT USER OPERATION INVESTIGATION FAILED:', error);
  }
}

// Run the investigation  
investigateAccountKitUserOp()
  .then(() => {
    console.log('\n🎉 Account Kit UserOp investigation completed');
  })
  .catch((error) => {
    console.error('💥 Investigation script error:', error);
  });
