// test-collabland-sdk.js
require('dotenv').config();
const collabLandSdk = require('@collabland/accountkit-sdk');
const AccountKit = collabLandSdk.default;

async function testSDK() {
  const apiKey = process.env.COLLABLAND_ACCOUNTKIT_API_KEY;
  const testUserId = '326397724675276802'; // Specific test user ID
  const qaBaseUrl = 'https://api-qa.collab.land';

  if (!apiKey) {
    console.error('Error: COLLABLAND_ACCOUNTKIT_API_KEY is not set in .env file.');
    return;
  }
  // testUserId is hardcoded, so no check needed here for it from .env

  console.log('Initializing AccountKit for QA environment with direct baseUrl override...');
  let accountKit;
  try {
    accountKit = new AccountKit(apiKey, { 
        baseUrl: qaBaseUrl 
    });
    console.log('AccountKit initialized.');
  } catch (initError) {
    console.error('Error initializing AccountKit:', initError);
    return;
  }

  const params = {
    platform: 'github', // Testing 'github' as per user request
    userId: testUserId,   // Using the provided test user ID with 'userId' key
  };

  console.log(`Attempting to call calculateAccountAddress with params:`, params);

  try {
    if (accountKit.v2 && typeof accountKit.v2.calculateAccountAddress === 'function') {
        console.log('Found accountKit.v2.calculateAccountAddress. Calling it with separate platform and userId arguments...');
        // The .toString() output showed: async calculateAccountAddress(platform, userId)
        const response = await accountKit.v2.calculateAccountAddress(params.platform, params.userId);
        console.log('SDK Response:', JSON.stringify(response, null, 2));
    } else {
        console.error('Could not find accountKit.v2.calculateAccountAddress method.');
    }
  } catch (error) {
    console.error('Error calling calculateAccountAddress via SDK:');
    if (error.response && error.response.data) {
      console.error('Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      if (error.response.data.error && error.response.data.error.details) {
        console.error('Validation Details:', JSON.stringify(error.response.data.error.details, null, 2));
      }
    } else if (error.data && error.status) {
        console.error('Status:', error.status);
        console.error('Error Data:', JSON.stringify(error.data, null, 2));
        if (error.data.error && error.data.error.details) {
            console.error('Validation Details:', JSON.stringify(error.data.error.details, null, 2));
        }
    } else if (error.request) {
      console.error('Request was made but no response received.');
    } else {
      console.error('Error message:', error.message);
    }
    console.error('Full error object structure (getOwnPropertyNames):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
}

testSDK();
