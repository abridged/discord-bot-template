/**
 * Quiz Funding Debugger
 * 
 * This script helps diagnose and verify token transfers for quiz funding.
 * It provides detailed information about the entire funding process.
 * 
 * Usage: 
 *   node scripts/debug-quiz-funding.js verify QUIZ_ID
 *   node scripts/debug-quiz-funding.js check-escrow ESCROW_ADDRESS
 *   node scripts/debug-quiz-funding.js track-transfers TOKEN_ADDRESS SENDER_ADDRESS RECEIVER_ADDRESS
 *   node scripts/debug-quiz-funding.js check-balance TOKEN_ADDRESS ACCOUNT_ADDRESS
 */

const { ethers } = require('ethers');
require('dotenv').config();
const FundingDebugger = require('../src/services/blockchain/fundingDebugger');

// Create provider
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// Create debugger instance
const fundingDebugger = new FundingDebugger(provider);

// Function to find a quiz in database
async function findQuiz(quizId) {
  try {
    // Initialize the database connection
    const { sequelize } = require('../src/database');
    const models = require('../src/database/models');
    
    const quiz = await models.quiz.findOne({
      where: { id: quizId }
    });
    
    if (!quiz) {
      console.log(`No quiz found with ID ${quizId}`);
      return null;
    }
    
    // Convert to plain object for easier manipulation
    return quiz.get({ plain: true });
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    console.log('\nFallback to manual entry:');
    return null;
  }
}

// Verify a quiz's funding status
async function verifyQuizFunding(quizId) {
  console.log('============== QUIZ FUNDING VERIFICATION ==============');
  console.log(`Quiz ID: ${quizId}`);
  
  // Try to find quiz in database
  let quiz = await findQuiz(quizId);
  
  if (!quiz) {
    console.log('Quiz not found in database or database connection failed.');
    console.log('Please enter the following information manually:');
    
    // If we can't connect to the database, ask for manual input
    const escrowAddress = process.argv[3] || await prompt('Escrow Contract Address: ');
    const tokenAddress = process.argv[4] || await prompt('Token Address: ');
    const rewardAmount = process.argv[5] || await prompt('Expected Reward Amount: ');
    const creatorWallet = process.argv[6] || await prompt('Creator Wallet Address: ');
    
    quiz = {
      id: quizId,
      escrowAddress,
      tokenAddress,
      rewardAmount,
      creatorWalletAddress: creatorWallet
    };
  }
  
  console.log('\n----- QUIZ DETAILS -----');
  console.log(`Quiz ID: ${quiz.id}`);
  console.log(`Token Address: ${quiz.tokenAddress}`);
  console.log(`Reward Amount: ${quiz.rewardAmount}`);
  console.log(`Creator Wallet: ${quiz.creatorWalletAddress}`);
  console.log(`Escrow Address: ${quiz.escrowAddress || 'Not set'}`);
  console.log(`Funding Status: ${quiz.fundingStatus || 'Unknown'}`);
  console.log(`Funding TX Hash: ${quiz.fundingTransactionHash || 'Not available'}`);
  
  // If we have an escrow address, verify it
  if (quiz.escrowAddress) {
    await fundingDebugger.verifyEscrowFunding(quiz.escrowAddress, quiz.rewardAmount);
  } else {
    console.log('\n❌ No escrow address found for this quiz');
  }
  
  // Check token balance of creator
  if (quiz.creatorWalletAddress && quiz.tokenAddress) {
    console.log('\n----- CREATOR TOKEN BALANCE -----');
    await fundingDebugger.checkBalance(quiz.tokenAddress, quiz.creatorWalletAddress);
  }
  
  // Check factory allowance
  if (quiz.creatorWalletAddress && quiz.tokenAddress) {
    const factoryAddress = process.env.QUIZ_FACTORY_V2_ADDRESS;
    if (factoryAddress) {
      console.log('\n----- FACTORY ALLOWANCE -----');
      await fundingDebugger.checkAllowance(quiz.tokenAddress, quiz.creatorWalletAddress, factoryAddress);
    }
  }
  
  // Track token transfers if transaction hash is available
  if (quiz.fundingTransactionHash) {
    console.log('\n----- TRANSACTION DETAILS -----');
    const txReceipt = await provider.getTransactionReceipt(quiz.fundingTransactionHash);
    
    if (txReceipt) {
      console.log(`Transaction Status: ${txReceipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Block Number: ${txReceipt.blockNumber}`);
      console.log(`Gas Used: ${txReceipt.gasUsed.toString()}`);
      
      // Track transfers from this block
      if (quiz.tokenAddress) {
        console.log('\n----- TOKEN TRANSFERS -----');
        await fundingDebugger.trackTransfers(
          quiz.tokenAddress, 
          txReceipt.blockNumber, 
          quiz.creatorWalletAddress, 
          quiz.escrowAddress
        );
      }
    } else {
      console.log('⚠️ Transaction not found or still pending');
    }
  }
  
  console.log('\n============== VERIFICATION COMPLETE ==============');
}

// Check escrow contract directly
async function checkEscrow(escrowAddress) {
  console.log('============== ESCROW CONTRACT CHECK ==============');
  console.log(`Escrow Address: ${escrowAddress}`);
  
  // First check if contract exists
  const code = await provider.getCode(escrowAddress);
  if (code === '0x') {
    console.log('❌ No contract found at this address');
    return;
  }
  
  console.log('✅ Contract exists at this address');
  
  // Get contract details
  try {
    const QuizEscrowABI = require('../contracts/artifacts/contracts/src/QuizEscrow.sol/QuizEscrow.json').abi;
    const escrow = new ethers.Contract(escrowAddress, QuizEscrowABI, provider);
    
    const quizId = await escrow.quizId();
    const tokenAddress = await escrow.tokenAddress();
    const rewardAmount = await escrow.rewardAmount();
    
    // Now verify funding using the debugger
    await fundingDebugger.verifyEscrowFunding(escrowAddress, rewardAmount);
    
    // Track transfers to this escrow
    if (tokenAddress) {
      console.log('\n----- RECENT TOKEN TRANSFERS TO ESCROW -----');
      // Look at last 1000 blocks
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(currentBlock - 1000, 0);
      await fundingDebugger.trackTransfers(tokenAddress, fromBlock, null, escrowAddress);
    }
  } catch (error) {
    console.error('Error checking escrow contract:', error.message);
  }
  
  console.log('\n============== CHECK COMPLETE ==============');
}

// Track token transfers
async function trackTransfers(tokenAddress, senderAddress, receiverAddress) {
  console.log('============== TRACKING TOKEN TRANSFERS ==============');
  
  // Get current block
  const currentBlock = await provider.getBlockNumber();
  // Look at last 1000 blocks
  const fromBlock = Math.max(currentBlock - 1000, 0);
  
  await fundingDebugger.trackTransfers(tokenAddress, fromBlock, senderAddress, receiverAddress);
  
  console.log('\n============== TRACKING COMPLETE ==============');
}

// Check token balance
async function checkBalance(tokenAddress, accountAddress) {
  console.log('============== CHECKING TOKEN BALANCE ==============');
  
  await fundingDebugger.checkBalance(tokenAddress, accountAddress);
  
  console.log('\n============== CHECK COMPLETE ==============');
}

// Simple prompt function
function prompt(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run the appropriate command
async function run() {
  const command = process.argv[2];
  
  if (!command) {
    console.log('Please specify a command:');
    console.log('  verify QUIZ_ID');
    console.log('  check-escrow ESCROW_ADDRESS');
    console.log('  track-transfers TOKEN_ADDRESS [SENDER_ADDRESS] [RECEIVER_ADDRESS]');
    console.log('  check-balance TOKEN_ADDRESS ACCOUNT_ADDRESS');
    process.exit(1);
  }
  
  try {
    switch (command) {
      case 'verify':
        const quizId = process.argv[3];
        if (!quizId) {
          console.error('Quiz ID is required');
          process.exit(1);
        }
        await verifyQuizFunding(quizId);
        break;
        
      case 'check-escrow':
        const escrowAddress = process.argv[3];
        if (!escrowAddress) {
          console.error('Escrow address is required');
          process.exit(1);
        }
        await checkEscrow(escrowAddress);
        break;
        
      case 'track-transfers':
        const tokenAddress = process.argv[3];
        const senderAddress = process.argv[4] || null;
        const receiverAddress = process.argv[5] || null;
        if (!tokenAddress) {
          console.error('Token address is required');
          process.exit(1);
        }
        await trackTransfers(tokenAddress, senderAddress, receiverAddress);
        break;
        
      case 'check-balance':
        const token = process.argv[3];
        const account = process.argv[4];
        if (!token || !account) {
          console.error('Token address and account address are required');
          process.exit(1);
        }
        await checkBalance(token, account);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error during execution:', error);
  }
}

run();
