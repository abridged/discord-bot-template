#!/usr/bin/env node

/**
 * Test just the contract encoding without Account Kit calls to avoid hangs
 */

require('dotenv').config();
const { ethers } = require('ethers');
const MotherFactoryABI = require('./contracts/artifacts/contracts/src/MotherFactory.sol/MotherFactory.json').abi;

async function testContractEncoding() {
  console.log('🔍 CONTRACT ENCODING TEST (No Account Kit calls)');
  console.log('='.repeat(60));
  
  try {
    // Test deployment parameters (realistic values)
    const testParams = {
      creator: '0x9Eb326F637f84222A0d7a7797f5808ae73A416fe', // Valid checksummed test address
      authorizedBot: '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee', // Bot address
      duration: 86400, // 24 hours
      correctReward: '1000000000000000', // 0.001 ETH in wei
      incorrectReward: '500000000000000', // 0.0005 ETH in wei  
    };
    
    console.log('✅ Test parameters:');
    console.log(JSON.stringify(testParams, null, 2));
    
    // Test ethers.js contract encoding (this is where the checksum error occurred)
    const encodedParams = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256", "uint256"],
      [testParams.creator, testParams.authorizedBot, testParams.duration, testParams.correctReward, testParams.incorrectReward]
    );
    
    console.log('✅ Contract encoding successful!');
    console.log(`✅ Encoded params: ${encodedParams}`);
    
    // Test contract interface encoding
    const contractInterface = new ethers.utils.Interface(MotherFactoryABI);
    const calldata = contractInterface.encodeFunctionData('deployContract', ['QuizEscrow', encodedParams]);
    
    console.log('✅ Function calldata encoding successful!');
    console.log(`✅ Calldata: ${calldata}`);
    
    // Calculate transaction value
    const totalFunding = ethers.BigNumber.from(testParams.correctReward).add(ethers.BigNumber.from(testParams.incorrectReward));
    const deploymentFee = ethers.utils.parseEther('0.001'); // Hardcoded fee
    const totalValue = totalFunding.add(deploymentFee);
    
    console.log('✅ Transaction value calculation successful!');
    console.log(`✅ Total funding: ${ethers.utils.formatEther(totalFunding)} ETH`);
    console.log(`✅ Deployment fee: ${ethers.utils.formatEther(deploymentFee)} ETH`);
    console.log(`✅ Total value: ${ethers.utils.formatEther(totalValue)} ETH`);
    
    // Final payload that would be sent to Account Kit
    const payload = {
      target: process.env.MOTHER_FACTORY_ADDRESS_V3,
      calldata: calldata,
      value: totalValue.toString()
    };
    
    console.log('✅ Account Kit payload prepared successfully!');
    console.log('✅ Payload structure:', JSON.stringify(payload, null, 2));
    
    console.log('='.repeat(60));
    console.log('🎯 CONCLUSION: Contract encoding is working correctly!');
    console.log('🎯 The issue is likely in the Account Kit SDK call, not the contract data.');
    
  } catch (error) {
    console.error('❌ CONTRACT ENCODING FAILED:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testContractEncoding().then(() => {
  console.log('🔍 Contract encoding test completed');
  process.exit(0);
}).catch((error) => {
  console.error('🚨 Test runner failed:', error);
  process.exit(1);
});
