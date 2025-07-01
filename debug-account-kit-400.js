/**
 * Debug Account Kit 400 Error
 * This script isolates the Account Kit API call to debug the 400 Bad Request error
 */

const { ethers } = require('ethers');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function debugAccountKit400() {
  console.log('🔍 Account Kit 400 Error Debug');
  console.log('==============================\n');
  
  // 1. Check Environment Variables
  console.log('1️⃣ Environment Variables:');
  console.log(`   BASE_SEPOLIA_RPC_URL: ${process.env.BASE_SEPOLIA_RPC_URL}`);
  console.log(`   COLLABLAND_ACCOUNTKIT_API_KEY: ${process.env.COLLABLAND_ACCOUNTKIT_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   USE_REAL_BLOCKCHAIN: ${process.env.USE_REAL_BLOCKCHAIN}`);
  
  // Check for RPC URL typo
  if (process.env.BASE_SEPOLIA_RPC_URL && process.env.BASE_SEPOLIA_RPC_URL.includes('orgx')) {
    console.log('   🚨 RPC URL TYPO DETECTED: Contains "orgx" instead of "org"');
  }
  console.log('');
  
  // 2. Test RPC Connection
  console.log('2️⃣ Testing RPC Connection:');
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  console.log(`   Testing: ${rpcUrl}`);
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    console.log(`   ✅ Network: ${network.name} (Chain ID: ${network.chainId})`);
    
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Latest block: ${blockNumber}`);
  } catch (error) {
    console.log(`   ❌ RPC Error: ${error.message}`);
    if (error.message.includes('orgx')) {
      console.log('   🚨 CONFIRMED: RPC URL typo is causing network failures');
    }
  }
  console.log('');
  
  // 3. Test Account Kit Environment
  console.log('3️⃣ Account Kit Environment:');
  const environment = process.env.COLLABLAND_ACCOUNT_KIT_ENVIRONMENT || 'QA';
  console.log(`   Environment: ${environment}`);
  
  // Expected API endpoints for different environments
  const expectedEndpoints = {
    'QA': 'https://api-qa.collab.land',
    'PROD': 'https://api.collab.land'
  };
  
  console.log(`   Expected endpoint: ${expectedEndpoints[environment] || 'Unknown'}`);
  console.log('');
  
  // 4. Create Test Payload
  console.log('4️⃣ Creating Test Payload:');
  const testPayload = {
    target: "0x85ef58b83366381122d341Dbc9B6689236060aa0",  // MotherFactory v3
    calldata: "0x57ae71d4000000000000000000000000b1e9c41e4153f455a30e66a2da37d515c81a16d100000000000000000000000000000000000000000000000000038d7ea4c68000000000000000000000000000da04681df85a8231b967e6cdefc332fcabeeb0ee000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000144d7946697273745175697a5465737431373332000000000000000000000000",
    value: "1000000000000000"  // 0.001 ETH
  };
  
  console.log('   Payload:', JSON.stringify(testPayload, null, 2));
  console.log('');
  
  // 5. Decode the calldata to verify it's correct
  console.log('5️⃣ Decoding Calldata:');
  try {
    const MotherFactoryABI = require('./src/contracts/MotherFactory.json');
    const iface = new ethers.utils.Interface(MotherFactoryABI);
    const decoded = iface.parseTransaction({ data: testPayload.calldata });
    
    console.log(`   Function: ${decoded.name}`);
    console.log(`   Parameters:`);
    decoded.args.forEach((arg, index) => {
      console.log(`     [${index}]: ${arg}`);
    });
  } catch (error) {
    console.log(`   ❌ Calldata decode error: ${error.message}`);
  }
  console.log('');
  
  // 6. Manual API Test (without SDK)
  console.log('6️⃣ Manual Account Kit API Test:');
  
  if (!process.env.COLLABLAND_ACCOUNTKIT_API_KEY) {
    console.log('   ❌ Cannot test: COLLABLAND_ACCOUNTKIT_API_KEY not set');
    return;
  }
  
  // Test with axios directly to isolate SDK issues
  const axios = require('axios');
  const apiKey = process.env.COLLABLAND_ACCOUNTKIT_API_KEY;
  const baseUrl = expectedEndpoints[environment];
  
  if (!baseUrl) {
    console.log('   ❌ Cannot test: Unknown environment');
    return;
  }
  
  const testUserId = 'debug-test-user';
  const chainId = '84532'; // Base Sepolia
  
  console.log(`   Testing direct API call to: ${baseUrl}`);
  console.log(`   Chain ID: ${chainId}`);
  console.log(`   User ID: ${testUserId}`);
  
  try {
    const response = await axios.post(
      `${baseUrl}/accountkit/v1/telegrambot/evm/submitUserOperation?chainId=${chainId}`,
      testPayload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      }
    );
    
    console.log('   ✅ Success! Response:', response.data);
  } catch (error) {
    console.log('   ❌ API Error Details:');
    console.log(`      Status: ${error.response?.status}`);
    console.log(`      Status Text: ${error.response?.statusText}`);
    console.log(`      Headers:`, error.response?.headers);
    console.log(`      Data:`, error.response?.data);
    
    if (error.response?.status === 400) {
      console.log('\n   🔍 400 Bad Request Analysis:');
      const errorData = error.response.data;
      
      if (typeof errorData === 'string' && errorData.includes('simulation')) {
        console.log('      • Likely cause: Contract simulation failed');
        console.log('      • Possible fixes:');
        console.log('        - Fix RPC URL typo in .env file');
        console.log('        - Check user wallet has sufficient funds');
        console.log('        - Verify contract address and calldata');
      }
      
      if (typeof errorData === 'object' && errorData.message) {
        console.log(`      • Error message: ${errorData.message}`);
      }
    }
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Fix RPC URL typo in your .env file if detected above');
  console.log('2. Ensure user wallet has sufficient ETH for gas + deployment fee');
  console.log('3. Check Account Kit environment and API key validity');
  console.log('4. Run bot deployment with fixed environment');
}

// Run the debug script
debugAccountKit400().catch(console.error);
