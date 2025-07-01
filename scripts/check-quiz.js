/**
 * Quiz Checking Script
 * 
 * This script fetches quiz details from the database and verifies its blockchain status
 * 
 * Usage: node scripts/check-quiz.js QUIZ_ID
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Initialize blockchain provider
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// ABI for interacting with contracts
const ERC20ABI = require('../contracts/artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json').abi;
const QuizEscrowABI = require('../contracts/artifacts/contracts/src/QuizEscrow.sol/QuizEscrow.json').abi;

async function main() {
  const quizId = process.argv[2];
  
  if (!quizId) {
    console.error('Please provide a quiz ID');
    console.log('Usage: node scripts/check-quiz.js QUIZ_ID');
    process.exit(1);
  }
  
  console.log('========== QUIZ VERIFICATION ==========');
  console.log(`Quiz ID: ${quizId}`);

  // Initialize database
  const { sequelize } = require('../src/database');
  const db = require('../src/database/models');

  try {
    // Find quiz in database
    const quiz = await db.Quiz.findOne({
      where: { id: quizId }
    });

    if (!quiz) {
      console.log(`❌ Quiz not found with ID: ${quizId}`);
      process.exit(1);
    }

    console.log('\n----- DATABASE RECORD -----');
    console.log(`Creator Discord ID: ${quiz.creatorDiscordId}`);
    console.log(`Creator Wallet: ${quiz.creatorWalletAddress || 'Not set'}`);
    console.log(`Token Address: ${quiz.tokenAddress}`);
    console.log(`Chain ID: ${quiz.chainId}`);
    console.log(`Reward Amount: ${quiz.rewardAmount}`);
    console.log(`Funding Status: ${quiz.fundingStatus}`);
    console.log(`Escrow Address: ${quiz.escrowAddress || 'Not deployed'}`);
    console.log(`Transaction Hash: ${quiz.transactionHash || 'No transaction'}`);
    console.log(`Funding Transaction: ${quiz.fundingTransactionHash || 'Not funded'}`);
    console.log(`On Chain: ${quiz.onChain ? 'Yes' : 'No'}`);
    console.log(`Created: ${quiz.createdAt}`);
    console.log(`Expires: ${quiz.expiresAt}`);

    // If we have an escrow address, check its status
    if (quiz.escrowAddress) {
      console.log('\n----- BLOCKCHAIN VERIFICATION -----');
      
      // Check if contract exists
      const code = await provider.getCode(quiz.escrowAddress);
      if (code === '0x') {
        console.log('❌ No contract found at escrow address');
      } else {
        console.log('✅ Escrow contract exists on blockchain');
        
        // Connect to escrow contract
        const escrow = new ethers.Contract(quiz.escrowAddress, QuizEscrowABI, provider);
        
        // Get contract details
        const contractQuizId = await escrow.quizId();
        const tokenAddress = await escrow.tokenAddress();
        const rewardAmount = await escrow.rewardAmount();
        const expiryTime = await escrow.expiryTime();
        const creator = await escrow.creator();
        
        console.log(`Quiz ID on chain: ${contractQuizId}`);
        console.log(`Token Address on chain: ${tokenAddress}`);
        console.log(`Reward Amount on chain: ${ethers.utils.formatUnits(rewardAmount, 18)}`); // Assuming 18 decimals
        console.log(`Expiry Time: ${new Date(expiryTime.toNumber() * 1000).toISOString()}`);
        console.log(`Creator on chain: ${creator}`);
        
        // Check if creator matches
        if (creator.toLowerCase() === (quiz.creatorWalletAddress || '').toLowerCase()) {
          console.log('✅ Creator address matches database record');
        } else {
          console.log('❌ Creator address mismatch');
        }
        
        // Check token balance
        const token = new ethers.Contract(tokenAddress, ERC20ABI, provider);
        const balance = await token.balanceOf(quiz.escrowAddress);
        
        console.log('\n----- TOKEN BALANCE -----');
        console.log(`Escrow Balance: ${ethers.utils.formatUnits(balance, 18)}`); // Assuming 18 decimals
        
        // Check if properly funded
        if (balance.gte(rewardAmount)) {
          console.log('✅ ESCROW IS FULLY FUNDED');
        } else {
          console.log('❌ ESCROW IS NOT FULLY FUNDED');
          console.log(`Missing: ${ethers.utils.formatUnits(rewardAmount.sub(balance), 18)}`);
        }
      }
    } else {
      console.log('\n❌ No escrow address in database - contract not deployed');
    }
  } catch (error) {
    console.error('Error checking quiz:', error);
  } finally {
    // Close database connection
    await sequelize.close();
  }

  console.log('\n========== VERIFICATION COMPLETE ==========');
}

main().catch(console.error);
