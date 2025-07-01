/**
 * Transaction Checking Script
 * 
 * This script fetches transaction details from the blockchain
 * 
 * Usage: node scripts/check-transaction.js TX_HASH
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Initialize blockchain provider with a single reliable endpoint
const rpcUrl = 'https://sepolia.base.org';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// Set a reasonable timeout
provider.pollingInterval = 500;

console.log(`Using RPC endpoint: ${rpcUrl}`);

// Add a timeout to the script itself
const scriptTimeout = setTimeout(() => {
  console.error('Script timed out after 10 seconds');
  process.exit(1);
}, 10000); // 10 second timeout

// ABIs for decoding logs
const QuizFactoryABI = require('../contracts/artifacts/contracts/src/QuizFactory.sol/QuizFactory.json').abi;
const QuizEscrowABI = require('../contracts/artifacts/contracts/src/QuizEscrow.sol/QuizEscrow.json').abi;

async function main() {
  const txHash = process.argv[2];
  
  if (!txHash) {
    console.error('Please provide a transaction hash');
    console.log('Usage: node scripts/check-transaction.js TX_HASH');
    process.exit(1);
  }
  
  console.log('========== TRANSACTION VERIFICATION ==========');
  console.log(`Transaction Hash: ${txHash}`);

  try {
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log(`❌ Transaction not found or not mined yet: ${txHash}`);
      process.exit(1);
    }

    console.log('\n----- TRANSACTION DETAILS -----');
    console.log(`Status: ${receipt.status ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`From: ${receipt.from}`);
    console.log(`To: ${receipt.to}`);
    
    // Get the transaction itself
    const tx = await provider.getTransaction(txHash);
    console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    
    // Get factory address from env
    const factoryAddress = process.env.QUIZ_FACTORY_V2_ADDRESS;
    console.log(`Quiz Factory Address: ${factoryAddress}`);
    
    // Check if this is a transaction to the factory
    if (receipt.to.toLowerCase() === factoryAddress.toLowerCase()) {
      console.log('\n----- QUIZ FACTORY TRANSACTION -----');
      
      // Create factory interface for decoding
      const factoryInterface = new ethers.utils.Interface(QuizFactoryABI);
      
      // Try to decode the transaction input
      try {
        const decodedData = factoryInterface.parseTransaction({ data: tx.data });
        console.log(`Function Called: ${decodedData.name}`);
        console.log(`Function Arguments:`, decodedData.args);
        
        if (decodedData.name === 'createQuizEscrow') {
          console.log('\n----- QUIZ ESCROW CREATION -----');
          console.log(`Quiz ID: ${decodedData.args[0]}`);
          console.log(`Token Address: ${decodedData.args[1]}`);
          console.log(`Reward Amount: ${ethers.utils.formatUnits(decodedData.args[2], 18)}`); // Assuming 18 decimals
          console.log(`Expiry Time: ${new Date(decodedData.args[3].toNumber() * 1000).toISOString()}`);
        }
      } catch (error) {
        console.log(`Could not decode transaction data: ${error.message}`);
      }
      
      // Look for QuizEscrowCreated event
      console.log('\n----- TRANSACTION LOGS -----');
      console.log(`Log Count: ${receipt.logs.length}`);
      
      for (const log of receipt.logs) {
        try {
          // Try to decode as QuizEscrowCreated event
          const factoryInterface = new ethers.utils.Interface(QuizFactoryABI);
          const decodedLog = factoryInterface.parseLog(log);
          
          console.log(`\nEvent: ${decodedLog.name}`);
          console.log(`Event Args:`, decodedLog.args);
          
          if (decodedLog.name === 'QuizEscrowCreated') {
            console.log('\n----- QUIZ ESCROW CREATED -----');
            console.log(`Quiz ID: ${decodedLog.args.quizId}`);
            console.log(`Escrow Address: ${decodedLog.args.escrowAddress}`);
            console.log(`Creator: ${decodedLog.args.creator}`);
            
            // Check if escrow has code
            const code = await provider.getCode(decodedLog.args.escrowAddress);
            console.log(`Contract deployed: ${code !== '0x' ? '✅ YES' : '❌ NO'}`);
          }
        } catch (error) {
          // Ignore errors from logs that don't match our interface
        }
      }
    }
    // Check if this was a token approval
    else {
      console.log('\n----- GENERAL TRANSACTION -----');
      console.log('This does not appear to be a direct QuizFactory transaction');
      
      // Try to decode logs anyway
      console.log('\n----- TRANSACTION LOGS -----');
      console.log(`Log Count: ${receipt.logs.length}`);
      
      const erc20Interface = new ethers.utils.Interface([
        'event Approval(address indexed owner, address indexed spender, uint256 value)'
      ]);
      
      for (const log of receipt.logs) {
        try {
          // Try to decode as Approval event
          const decodedLog = erc20Interface.parseLog(log);
          
          if (decodedLog.name === 'Approval') {
            console.log('\n----- TOKEN APPROVAL -----');
            console.log(`Owner: ${decodedLog.args.owner}`);
            console.log(`Spender: ${decodedLog.args.spender}`);
            console.log(`Amount: ${ethers.utils.formatUnits(decodedLog.args.value, 18)}`); // Assuming 18 decimals
          }
        } catch (error) {
          // Ignore errors from logs that don't match our interface
        }
      }
    }
  } catch (error) {
    console.error('Error checking transaction:', error);
  }

  console.log('\n========== VERIFICATION COMPLETE ==========');
  
  // Clear the timeout to prevent the script from hanging
  clearTimeout(scriptTimeout);
}

// Use a promise with a timeout to prevent hanging
main()
  .catch(console.error)
  .finally(() => {
    // Always clear the timeout and exit
    clearTimeout(scriptTimeout);
    // Force exit after 1 second in case there are hanging connections
    setTimeout(() => process.exit(0), 1000);
  });
