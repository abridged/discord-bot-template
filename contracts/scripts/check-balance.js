/**
 * Script to check the wallet balance on Base Sepolia
 * 
 * This script helps verify if the wallet has enough funds for deployment.
 * 
 * Usage:
 * npx hardhat run scripts/check-balance.js --network baseSepolia
 */

const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  console.log("Checking wallet balance on Base Sepolia...");
  console.log("Network:", hre.network.name);
  
  // Get the wallet from hardhat configuration
  const [deployer] = await ethers.getSigners();
  
  // Get the address
  const address = await deployer.getAddress();
  
  // Get the balance
  const balance = await deployer.getBalance();
  
  // Format the balance
  const balanceInEth = ethers.utils.formatEther(balance);
  
  console.log("Wallet address:", address);
  console.log("Balance:", balanceInEth, "ETH");
  console.log("Balance (wei):", balance.toString());
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.log("\n⚠️ WARNING: Low balance detected!");
    console.log("You need at least 0.01 ETH on Base Sepolia to deploy contracts.");
    console.log("Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-sepolia-faucet");
  }
  
  return { address, balance };
}

// Execute the check
main()
  .then(({ address, balance }) => {
    console.log("✅ Balance check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error checking balance:", error);
    process.exit(1);
  });
