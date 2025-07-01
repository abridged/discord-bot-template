const { getTransaction } = require('../src/account-kit/sdk');
require('dotenv').config();

async function testAccountKitTransaction() {
  console.log('🧪 ACCOUNT KIT TRANSACTION TEST');
  console.log('==============================');
  
  try {
    // Test with our known successful transaction hash
    const successfulTxHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    
    console.log(`🔍 Testing Account Kit getTransaction with: ${successfulTxHash}`);
    
    const startTime = Date.now();
    const txData = await getTransaction(successfulTxHash);
    const endTime = Date.now();
    
    console.log(`⏱️  Account Kit getTransaction completed in ${endTime - startTime}ms`);
    console.log(`📊 Transaction Data:`, JSON.stringify(txData, null, 2));
    
    // Check what data Account Kit provides
    if (txData) {
      console.log('\n✅ SUCCESS: Account Kit retrieved transaction data!');
      console.log(`📋 Status: ${txData.status}`);
      console.log(`🔗 Chain ID: ${txData.chainId}`);
      console.log(`💰 Value: ${txData.value}`);
      console.log(`📤 From: ${txData.from}`);
      console.log(`📥 To: ${txData.to}`);
      
      if (txData.logs || txData.events) {
        console.log(`🎉 BONUS: Transaction includes logs/events!`);
        console.log(`📝 Logs:`, txData.logs);
        console.log(`🎪 Events:`, txData.events);
      } else {
        console.log(`ℹ️  No logs/events in response - basic transaction data only`);
      }
      
    } else {
      console.log('❌ FAILED: No transaction data returned');
    }
    
  } catch (error) {
    console.error('❌ ACCOUNT KIT TRANSACTION TEST FAILED:', error);
    
    // Check if it's a network issue or API issue
    if (error.message.includes('could not detect network')) {
      console.log('🚫 Same network detection issue - Account Kit uses different provider');
    } else {
      console.log('💡 Different error - might be API limitation or config issue');
    }
  }
}

// Run the test  
testAccountKitTransaction()
  .then(() => {
    console.log('\n🎉 Account Kit transaction test completed');
  })
  .catch((error) => {
    console.error('💥 Test script error:', error);
  });
