const { getAccountKitClient } = require('../src/account-kit/sdk');
const axios = require('axios');
require('dotenv').config();

async function debugAccountKitAPI() {
  console.log('🔍 ACCOUNT KIT API DEBUGGING');
  console.log('============================');
  
  try {
    // Get Account Kit client and examine its configuration
    const client = getAccountKitClient();
    
    console.log('📋 Account Kit Configuration:');
    console.log(`   Base URL: ${client.v1?.baseUrl || client.baseUrl}`);
    console.log(`   API Key: ${client.v1?.apiKey ? '[PRESENT]' : '[MISSING]'}`);
    console.log(`   Environment: ${process.env.ACCOUNT_KIT_ENV || 'unknown'}`);
    
    // Test user operation hash
    const userOpHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    
    console.log(`\n🎯 UserOp Hash: ${userOpHash}`);
    
    // Test 1: Manual API call to understand the expected request format
    console.log('\n📋 TEST 1: Manual API call structure analysis');
    console.log('============================================');
    
    const baseUrl = client.v1?.baseUrl || 'https://api-qa.collab.land';
    const apiKey = client.v1?.apiKey || process.env.ACCOUNT_KIT_API_KEY;
    
    // Examine possible API endpoints for user operation receipt
    const possibleEndpoints = [
      `/accountkit/v1/telegrambot/evm/getUserOperationReceipt?userOpHash=${userOpHash}`,
      `/accountkit/v1/telegrambot/evm/getUserOperationReceipt`,
      `/v2/platform/evm/getUserOperationReceipt?userOpHash=${userOpHash}`,
      `/v2/platform/evm/getUserOperationReceipt`,
      `/accountkit/v1/evm/getUserOperationReceipt?userOpHash=${userOpHash}`,
      `/accountkit/v1/evm/getUserOperationReceipt`
    ];
    
    console.log('🔍 Testing possible API endpoints:');
    
    for (const endpoint of possibleEndpoints) {
      console.log(`\n🧪 Testing: ${baseUrl}${endpoint}`);
      
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log(`✅ Success: ${response.status}`);
        console.log(`📊 Response:`, response.data);
        
      } catch (error) {
        console.log(`❌ Error: ${error.response?.status || 'Network'} - ${error.response?.statusText || error.message}`);
        
        if (error.response?.data) {
          console.log(`📋 Error Details:`, error.response.data);
        }
      }
    }
    
    // Test 2: Examine the actual SDK method call
    console.log('\n📋 TEST 2: SDK method call with debug info');
    console.log('=========================================');
    
    try {
      // Enable debug logging if possible
      if (client.v1?.logger) {
        console.log('📋 Logger available - enabling debug mode');
      }
      
      console.log('🚀 Calling telegramBotGetEvmUserOperationReceipt...');
      
      // Call with additional error handling
      const result = await client.v1.telegramBotGetEvmUserOperationReceipt(userOpHash);
      
      console.log('✅ SDK call successful:');
      console.log(JSON.stringify(result, null, 2));
      
    } catch (sdkError) {
      console.log('❌ SDK call failed:', sdkError.message);
      
      // Extract more details from the error
      if (sdkError.response) {
        console.log(`📊 Response Status: ${sdkError.response.status}`);
        console.log(`📊 Response Headers:`, sdkError.response.headers);
        console.log(`📊 Response Data:`, sdkError.response.data);
      }
      
      if (sdkError.config) {
        console.log(`📊 Request URL: ${sdkError.config.url}`);
        console.log(`📊 Request Method: ${sdkError.config.method}`);
        console.log(`📊 Request Headers:`, sdkError.config.headers);
        console.log(`📊 Request Data:`, sdkError.config.data);
      }
    }
    
    // Test 3: Check if the user operation exists in a different format
    console.log('\n📋 TEST 3: UserOp hash format analysis');
    console.log('====================================');
    
    console.log(`🔍 UserOp Hash Analysis:`);
    console.log(`   Length: ${userOpHash.length} (expected: 66 for 0x + 64 hex chars)`);
    console.log(`   Format: ${userOpHash.match(/^0x[a-fA-F0-9]{64}$/) ? 'Valid' : 'Invalid'}`);
    console.log(`   Network: Base Sepolia (Chain ID: 84532)`);
    
    // Check if we need additional parameters
    console.log('\n🔍 Possible required parameters:');
    console.log('   - chainId: 84532 (Base Sepolia)');
    console.log('   - platform: telegram/discord/github');
    console.log('   - userId: Discord user ID');
    console.log('   - walletAddress: Smart account address');
    
  } catch (error) {
    console.error('💥 DEBUG SCRIPT ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the debug investigation
debugAccountKitAPI()
  .then(() => {
    console.log('\n🎉 Account Kit API debugging completed');
  })
  .catch((error) => {
    console.error('💥 Debug script error:', error);
  });
