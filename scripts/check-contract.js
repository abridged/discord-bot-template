/**
 * Quick Blockchain Contract Verification
 * 
 * This script checks if a contract exists at a specific address and verifies
 * token balances for quiz escrow contracts.
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Import ABIs
const QuizEscrowABI = require('../contracts/artifacts/contracts/src/QuizEscrow.sol/QuizEscrow.json').abi;
const ERC20ABI = require('../contracts/artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json').abi;

async function verifyContract(contractAddress) {
  try {
    console.log('============== CONTRACT VERIFICATION ==============');
    console.log(`Checking contract at address: ${contractAddress}`);
    
    // Initialize provider
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Check if there's code at the address
    const code = await provider.getCode(contractAddress);
    
    if (code === '0x') {
      console.log('❌ No contract found at this address');
      return;
    }
    
    console.log('✅ Contract exists at this address');
    
    // Attempt to connect to it as a quiz escrow
    try {
      const escrow = new ethers.Contract(contractAddress, QuizEscrowABI, provider);
      
      // Get basic contract data
      const tokenAddress = await escrow.tokenAddress();
      const rewardAmount = await escrow.rewardAmount();
      const expiryTime = await escrow.expiryTime();
      const creator = await escrow.creator();
      
      console.log('\n----- ESCROW CONTRACT DATA -----');
      console.log(`Quiz ID: ${await escrow.quizId()}`);
      console.log(`Token Address: ${tokenAddress}`);
      console.log(`Reward Amount: ${ethers.utils.formatUnits(rewardAmount, 'wei')} (raw: ${rewardAmount.toString()})`);
      console.log(`Expiry Time: ${new Date(expiryTime.toNumber() * 1000).toISOString()}`);
      console.log(`Creator: ${creator}`);
      
      // Check token details and balance
      const token = new ethers.Contract(tokenAddress, ERC20ABI, provider);
      
      try {
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const escrowBalance = await token.balanceOf(contractAddress);
        
        console.log('\n----- TOKEN BALANCE -----');
        console.log(`Token Symbol: ${symbol}`);
        console.log(`Token Decimals: ${decimals}`);
        console.log(`Escrow Balance: ${ethers.utils.formatUnits(escrowBalance, decimals)} ${symbol}`);
        console.log(`Raw Balance: ${escrowBalance.toString()}`);
        
        if (escrowBalance.gte(rewardAmount)) {
          console.log('✅ Escrow is FULLY FUNDED! The contract has sufficient tokens.');
        } else {
          console.log(`❌ Escrow is UNDER-FUNDED! Expected ${rewardAmount.toString()}, has ${escrowBalance.toString()}`);
        }
      } catch (error) {
        console.error('Error checking token details:', error.message);
      }
      
    } catch (error) {
      console.error('Error connecting to contract as Quiz Escrow:', error.message);
      console.log('This might not be a Quiz Escrow contract or it might be an older/incompatible version.');
    }
    
    console.log('\n============== VERIFICATION COMPLETE ==============');
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

// Get contract address from command line arguments
const contractAddress = process.argv[2];

if (!contractAddress) {
  console.error('Please provide a contract address as an argument');
  console.log('Usage: node scripts/check-contract.js CONTRACT_ADDRESS');
  process.exit(1);
}

verifyContract(contractAddress);
