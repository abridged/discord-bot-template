/**
 * Direct Quiz Funding Script
 * 
 * This script manually funds a quiz using the deployment private key
 * from the .env file, bypassing the normal Discord bot flow.
 * 
 * Usage: node scripts/fund-quiz.js QUIZ_ID
 */

require('dotenv').config();
const { ethers } = require('ethers');
const QuizService = require('../src/services/blockchain/quizService');
const { sequelize } = require('../src/database');
const db = require('../src/database/models');

async function main() {
  const quizId = process.argv[2];
  
  if (!quizId) {
    console.error('Please provide a quiz ID');
    console.log('Usage: node scripts/fund-quiz.js QUIZ_ID');
    process.exit(1);
  }
  
  console.log('========== DIRECT QUIZ FUNDING ==========');
  console.log(`Quiz ID: ${quizId}`);

  try {
    // Find quiz in database
    const quiz = await db.Quiz.findOne({
      where: { id: quizId }
    });

    if (!quiz) {
      console.log(`❌ Quiz not found with ID: ${quizId}`);
      process.exit(1);
    }

    console.log('\n----- QUIZ DETAILS -----');
    console.log(`Creator Discord ID: ${quiz.creatorDiscordId}`);
    console.log(`Token Address: ${quiz.tokenAddress}`);
    console.log(`Chain ID: ${quiz.chainId}`);
    console.log(`Reward Amount: ${quiz.rewardAmount}`);
    
    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );
    
    if (!process.env.DEPLOYMENT_PK) {
      console.error('❌ No deployment private key found in .env file');
      process.exit(1);
    }
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(process.env.DEPLOYMENT_PK, provider);
    console.log(`Using wallet: ${wallet.address}`);
    
    // Initialize quiz service
    const quizService = new QuizService();
    quizService.connect(wallet);
    
    // Calculate quiz expiry time (end of next day UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setUTCHours(23, 59, 59, 999);
    const expiryTime = Math.floor(tomorrow.getTime() / 1000); // Convert to Unix timestamp
    
    // Format token amount for blockchain (convert to wei/smallest units)
    const tokenAmount = ethers.utils.parseUnits(quiz.rewardAmount.toString(), 18);
    
    console.log('\n----- FUNDING PARAMETERS -----');
    console.log(`Token Address: ${quiz.tokenAddress}`);
    console.log(`Token Amount: ${quiz.rewardAmount} (${tokenAmount.toString()} wei)`);
    console.log(`Expiry Time: ${expiryTime} (${new Date(expiryTime * 1000).toISOString()})`);
    
    // Check token balance
    const tokenContract = new ethers.Contract(
      quiz.tokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'],
      provider
    );
    
    const symbol = await tokenContract.symbol();
    const balance = await tokenContract.balanceOf(wallet.address);
    const formattedBalance = ethers.utils.formatUnits(balance, 18);
    
    console.log(`\nWallet Balance: ${formattedBalance} ${symbol}`);
    
    if (balance.lt(tokenAmount)) {
      console.error(`❌ Insufficient token balance. Need ${ethers.utils.formatUnits(tokenAmount, 18)} ${symbol}, but only have ${formattedBalance} ${symbol}`);
      process.exit(1);
    }
    
    console.log(`\n----- FUNDING QUIZ ESCROW -----`);
    console.log('Creating escrow contract and funding it...');
    
    // Create quiz with direct funding
    const result = await quizService.createQuiz({
      quizId: quiz.id,
      tokenAddress: quiz.tokenAddress,
      rewardAmount: tokenAmount,
      expiryTime
    });
    
    console.log('\n----- TRANSACTION RESULT -----');
    console.log(`Escrow Address: ${result.escrowAddress}`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    
    // Update quiz in database
    await quiz.update({
      escrowAddress: result.escrowAddress,
      transactionHash: result.transactionHash,
      expiryTime: expiryTime,
      onChain: true,
      creatorWalletAddress: wallet.address,
      fundingStatus: 'funded',
      fundingTransactionHash: result.transactionHash
    });
    
    console.log('\n✅ Quiz successfully funded and updated in database!');
    console.log(`View transaction: https://sepolia.basescan.org/tx/${result.transactionHash}`);
    console.log(`View escrow contract: https://sepolia.basescan.org/address/${result.escrowAddress}`);
    
  } catch (error) {
    console.error('\n❌ Error funding quiz:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
  }
}

main();
