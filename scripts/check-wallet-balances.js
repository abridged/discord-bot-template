/**
 * Check Wallet Balances Script
 * 
 * This script checks all relevant wallet balances for the project
 * 
 * Usage: node scripts/check-wallet-balances.js
 */

require('dotenv').config();
const { ethers } = require('ethers');

// ERC20 interface ABI (minimal for balance checking)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

async function main() {
  console.log('========== WALLET BALANCE CHECKER ==========');
  
  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
  );
  
  // Define wallets to check
  const wallets = [];
  
  // Add deployment wallet if available
  if (process.env.DEPLOYMENT_PK) {
    const deploymentWallet = new ethers.Wallet(process.env.DEPLOYMENT_PK, provider);
    wallets.push({
      name: 'Deployment Wallet',
      address: deploymentWallet.address,
      privateKey: 'From DEPLOYMENT_PK'
    });
  }
  
  // Get collab.land bot wallet if available
  try {
    // Simply import the account-kit SDK to get the bot wallet
    const { getBotWallet } = require('../src/account-kit/sdk');
    const botWalletAddress = await getBotWallet();
    
    if (botWalletAddress) {
      wallets.push({
        name: 'Account Kit Bot Wallet',
        address: botWalletAddress,
        privateKey: 'Managed by Account Kit'
      });
    }
  } catch (error) {
    console.log('Could not get Account Kit Bot Wallet:', error.message);
  }
  
  // Add user-defined wallets (if any in .env)
  if (process.env.USER_WALLET_ADDRESS) {
    wallets.push({
      name: 'User Wallet',
      address: process.env.USER_WALLET_ADDRESS,
      privateKey: 'Not available'
    });
  }
  
  if (wallets.length === 0) {
    console.log('No wallets configured for checking');
    return;
  }
  
  // Get token address to check
  const tokenAddress = process.env.SEED_TOKEN || '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1';
  console.log(`Checking token: ${tokenAddress}\n`);
  
  // Connect to token contract
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  try {
    // Get token details
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    
    console.log(`Token Symbol: ${symbol}`);
    console.log(`Token Decimals: ${decimals}`);
    console.log('----------------------------------------');
    
    // Check balances for all wallets
    for (const wallet of wallets) {
      console.log(`\n[${wallet.name}]`);
      console.log(`Address: ${wallet.address}`);
      console.log(`Private Key: ${wallet.privateKey}`);
      
      // Check ETH balance
      const ethBalance = await provider.getBalance(wallet.address);
      console.log(`ETH Balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
      
      // Check token balance
      const tokenBalance = await tokenContract.balanceOf(wallet.address);
      console.log(`${symbol} Balance: ${ethers.utils.formatUnits(tokenBalance, decimals)} ${symbol}`);
      console.log('----------------------------------------');
    }
    
    // Check factory contract settings
    const quizFactoryAddress = process.env.QUIZ_FACTORY_V2_ADDRESS;
    if (quizFactoryAddress) {
      console.log('\n[Quiz Factory Contract]');
      console.log(`Address: ${quizFactoryAddress}`);
      
      // Check if contract exists
      const code = await provider.getCode(quizFactoryAddress);
      if (code === '0x') {
        console.log('❌ No contract deployed at this address');
      } else {
        console.log('✅ Contract exists at this address');
      }
    }
  } catch (error) {
    console.error('Error checking balances:', error);
  }
  
  console.log('\n========== BALANCE CHECK COMPLETE ==========');
}

main().catch(console.error);
