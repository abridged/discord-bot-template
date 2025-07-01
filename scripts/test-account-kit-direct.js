#!/usr/bin/env node

/**
 * Direct Account Kit API Test
 * Isolates the Account Kit call to debug 400 error without bot orchestration
 */

const axios = require('axios');
require('dotenv').config();

async function testAccountKitDirect() {
  console.log('🔍 DIRECT ACCOUNT KIT TEST');
  console.log('='.repeat(50));

  // Test parameters (same as what the bot would send)
  const contractAddress = process.env.MOTHER_FACTORY_ADDRESS || '0x85ef58b83366381122d341Dbc9B6689236060aa0';
  const chainId = '84532'; // Base Sepolia
  const discordUserId = '326397724675276802'; // Test user ID from logs

  // Mock transaction parameters that would be sent to Account Kit
  const txParams = {
    to: contractAddress,
    data: '0x12345678', // Mock calldata
    value: '0'
  };

  console.log('🔍 Environment Check:');
  console.log('- API Key present:', !!process.env.COLLABLAND_ACCOUNTKIT_API_KEY);
  console.log('- Bot Token present:', !!process.env.TELEGRAM_BOT_TOKEN);
  console.log('- Mother Factory:', contractAddress);
  console.log('- Chain ID:', chainId);
  console.log('- Discord User ID:', discordUserId);

  // Test Account Kit API directly
  const apiKey = process.env.COLLABLAND_ACCOUNTKIT_API_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!apiKey) {
    console.error('❌ Missing COLLABLAND_ACCOUNTKIT_API_KEY');
    return;
  }

  if (!botToken) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN');
    return;
  }

  console.log('\n🚀 Testing Account Kit API Call...');
  
  const requestPayload = {
    target: txParams.to,
    calldata: txParams.data,
    value: txParams.value
  };

  console.log('📋 Request Payload:', JSON.stringify(requestPayload, null, 2));

  // Test the direct API endpoint (same as SDK uses)
  const baseUrl = 'https://api-qa.collab.land/accountkit';
  const apiUrl = `${baseUrl}/v1/telegrambot/evm/submitUserOperation?chainId=${chainId}`;

  console.log('📍 API URL:', apiUrl);

  try {
    const response = await axios.post(apiUrl, requestPayload, {
      headers: {
        'X-API-KEY': apiKey,
        'X-TG-BOT-TOKEN': botToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ FAILED!');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.error('\n🚨 400 BAD REQUEST ANALYSIS:');
        console.error('- Check if Discord User ID is valid for Account Kit');
        console.error('- Check if API endpoint URL is correct');
        console.error('- Check if request payload format matches API expectations');
        console.error('- Check if authentication headers are correct');
      }
    } else {
      console.error('No response received - network error?');
    }
  }
}

// Run the test
testAccountKitDirect()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
