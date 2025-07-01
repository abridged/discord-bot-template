#!/usr/bin/env node

/**
 * Real MotherFactory Deployment Call Test
 * Tests the actual deployContract function with real parameters
 */

const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

// Import ABI for encoding
const MotherFactoryABI = require('../contracts/artifacts/contracts/src/MotherFactory.sol/MotherFactory.json').abi;

async function testRealDeploymentCall() {
  console.log(' REAL MOTHERFACTORY DEPLOYMENT TEST');
  console.log('='.repeat(50));

  // Real contract parameters
  const contractAddress = process.env.MOTHER_FACTORY_ADDRESS || '0x85ef58b83366381122d341Dbc9B6689236060aa0';
  const chainId = '84532'; // Base Sepolia
  const discordUserId = '326397724675276802'; // Test user ID

  console.log(' Environment Check:');
  console.log('- API Key present:', !!process.env.COLLABLAND_ACCOUNTKIT_API_KEY);
  console.log('- Bot Token present:', !!process.env.TELEGRAM_BOT_TOKEN);
  console.log('- Mother Factory:', contractAddress);
  console.log('- Chain ID:', chainId);
  console.log('- Discord User ID:', discordUserId);

  // Create REAL deployContract parameters (same as QuizService)
  const contractType = 'QuizEscrow';
  
  // Mock quiz parameters (same structure as real quiz)
  const quizParams = {
    title: 'Test Quiz',
    description: 'Test Description',
    questions: [
      {
        questionText: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1
      }
    ],
    creatorDiscordId: discordUserId,
    timeLimit: 60,
    prizeAmount: '1000000000000000', // 0.001 ETH in wei
    expiryTime: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
  };

  console.log('\n Encoding Contract Parameters...');

  // Encode parameters exactly like QuizService does
  const encodedParams = ethers.utils.defaultAbiCoder.encode(
    ['string', 'string', 'string', 'string', 'uint256', 'uint256', 'string[]', 'string[][]', 'uint256[]'],
    [
      quizParams.title,
      quizParams.description,
      quizParams.creatorDiscordId,
      process.env.BOT_WALLET_ADDRESS || '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee',
      quizParams.prizeAmount,
      quizParams.expiryTime,
      quizParams.questions.map(q => q.questionText),
      quizParams.questions.map(q => q.options),
      quizParams.questions.map(q => q.correctAnswer)
    ]
  );

  console.log(' Parameters encoded successfully');
  console.log('- Contract Type:', contractType);
  console.log('- Encoded Params Length:', encodedParams.length);

  // Create deployContract function call data
  const motherFactoryInterface = new ethers.utils.Interface(MotherFactoryABI);
  const calldata = motherFactoryInterface.encodeFunctionData('deployContract', [
    contractType,
    encodedParams
  ]);

  console.log(' Function calldata encoded');
  console.log('- Function:', 'deployContract');
  console.log('- Calldata:', calldata.substring(0, 50) + '...');

  // Test Account Kit API with REAL parameters
  const apiKey = process.env.COLLABLAND_ACCOUNTKIT_API_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!apiKey || !botToken) {
    console.error(' Missing API credentials');
    return;
  }

  const deploymentFee = '100000000000000'; // 0.0001 ETH
  const totalValue = (BigInt(quizParams.prizeAmount) + BigInt(deploymentFee)).toString();

  const requestPayload = {
    target: contractAddress,
    calldata: calldata,
    value: totalValue
  };

  console.log('\n Testing REAL Account Kit Deployment...');
  console.log(' Request Payload:');
  console.log('- Target:', requestPayload.target);
  console.log('- Value:', requestPayload.value, '(wei)');
  console.log('- Calldata length:', requestPayload.calldata.length);

  const baseUrl = 'https://api-qa.collab.land/accountkit';
  const apiUrl = `${baseUrl}/v1/telegrambot/evm/submitUserOperation?chainId=${chainId}`;

  try {
    const response = await axios.post(apiUrl, requestPayload, {
      headers: {
        'X-API-KEY': apiKey,
        'X-TG-BOT-TOKEN': botToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log(' SUCCESS! UserOp Submitted!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    // Look for userOp hash / transaction hash
    if (response.data?.transactionHash) {
      console.log('\n USEROPE HASH FOUND:', response.data.transactionHash);
    } else if (response.data?.hash) {
      console.log('\n HASH FOUND:', response.data.hash);
    } else {
      console.log('\n No direct hash found, full response:', response.data);
    }

  } catch (error) {
    console.error(' FAILED!');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('\n Error Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.error('\n Contract Call Analysis:');
        const errorData = error.response.data?.error?.message || '';
        if (errorData.includes('simulation')) {
          console.error('- Contract simulation failed');
          console.error('- Check contract function exists and parameters are valid');
        }
        if (errorData.includes('insufficient')) {
          console.error('- Insufficient funds for transaction');
        }
        if (errorData.includes('revert')) {
          console.error('- Contract execution reverted');
        }
      }
    }
  }
}

// Run the test
testRealDeploymentCall()
  .then(() => {
    console.log('\n Real deployment test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error(' Test failed:', error);
    process.exit(1);
  });
