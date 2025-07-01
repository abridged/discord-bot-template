/**
 * Transaction Checking Script Using Block Explorer API
 * 
 * This script fetches transaction details from the Base Sepolia block explorer API
 * 
 * Usage: node scripts/check-tx-api.js TX_HASH
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

// Base Sepolia explorer API endpoint
const API_URL = 'https://api-sepolia.basescan.org/api';
// You would normally use an API key here, but we'll use the public access for now
const API_KEY = process.env.BASESCAN_API_KEY || '';

async function main() {
  const txHash = process.argv[2];
  
  if (!txHash) {
    console.error('Please provide a transaction hash');
    console.log('Usage: node scripts/check-tx-api.js TX_HASH');
    process.exit(1);
  }
  
  console.log('========== TRANSACTION VERIFICATION (API) ==========');
  console.log(`Transaction Hash: ${txHash}`);
  console.log(`Explorer Link: https://sepolia.basescan.org/tx/${txHash}`);
  
  try {
    // Get transaction details using the API
    const txResponse = await axios.get(API_URL, {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionByHash',
        txhash: txHash,
        apikey: API_KEY
      }
    });
    
    if (txResponse.data.error) {
      console.error(`API Error: ${txResponse.data.error.message}`);
      process.exit(1);
    }
    
    if (!txResponse.data.result) {
      console.log(`❌ Transaction not found via API: ${txHash}`);
      process.exit(1);
    }
    
    const tx = txResponse.data.result;
    
    console.log('\n----- TRANSACTION DETAILS -----');
    console.log(`Block Number: ${parseInt(tx.blockNumber, 16)}`);
    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    console.log(`Gas: ${parseInt(tx.gas, 16)}`);
    console.log(`Gas Price: ${ethers.utils.formatUnits(tx.gasPrice, 'gwei')} Gwei`);
    console.log(`Nonce: ${parseInt(tx.nonce, 16)}`);
    
    // Get transaction receipt for status
    const receiptResponse = await axios.get(API_URL, {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionReceipt',
        txhash: txHash,
        apikey: API_KEY
      }
    });
    
    if (receiptResponse.data.result) {
      const receipt = receiptResponse.data.result;
      console.log(`Status: ${receipt.status === '0x1' ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Gas Used: ${parseInt(receipt.gasUsed, 16)}`);
      
      // Check for contract creation
      if (receipt.contractAddress) {
        console.log(`\n----- CONTRACT CREATION -----`);
        console.log(`Contract Address: ${receipt.contractAddress}`);
      }
      
      // Get logs
      console.log(`\n----- TRANSACTION LOGS -----`);
      console.log(`Log Count: ${receipt.logs.length}`);
      
      // Look for QuizEscrowCreated event (topic0 = keccak256("QuizEscrowCreated(string,address,address)"))
      const quizEscrowCreatedTopic = '0x1f401bc09ad19d8d20e264e03e3966827c770a54ed36799f25604679dd80bf69';
      
      for (const log of receipt.logs) {
        if (log.topics && log.topics[0] === quizEscrowCreatedTopic) {
          console.log(`\n----- QUIZ ESCROW CREATED EVENT -----`);
          // The escrow address should be in data or in topics[2]
          console.log(`Log Address (Factory): ${log.address}`);
          console.log(`Topics: ${log.topics.join(', ')}`);
          console.log(`Data: ${log.data}`);
          
          // Try to decode the event data
          try {
            // The escrow address is likely in the data field or in topics[2]
            // This is a simple approximation and might need adjustment based on actual contract
            const escrowAddress = log.topics[2] ? 
              `0x${log.topics[2].slice(26)}` : // Extract address from topic if present
              `0x${log.data.slice(26, 66)}`; // Extract from data field otherwise
              
            console.log(`Possible Escrow Address: ${escrowAddress}`);
          } catch (error) {
            console.log(`Could not decode event data: ${error.message}`);
          }
        }
      }
    } else {
      console.log(`❌ Transaction receipt not found`);
    }
    
  } catch (error) {
    console.error('Error checking transaction:', error.message);
  }

  console.log('\n========== VERIFICATION COMPLETE ==========');
}

// Run with timeout to prevent hanging
const timeout = setTimeout(() => {
  console.error('Script timed out after 10 seconds');
  process.exit(1);
}, 10000);

main()
  .catch(console.error)
  .finally(() => {
    clearTimeout(timeout);
    setTimeout(() => process.exit(0), 1000);
  });
