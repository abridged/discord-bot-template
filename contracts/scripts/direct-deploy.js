/**
 * Direct deployment script for QuizFactory
 * 
 * This script bypasses hardhat's account configuration and directly uses the private key
 * from the .env file to create a wallet and deploy the contract.
 */

const { ethers } = require("ethers");
require('dotenv').config({path: '../.env'});

async function main() {
  // Load the private key from .env and ensure proper format
  let privateKey = process.env.DEPLOYMENT_PK;
  
  // Remove any 0x prefix and then ensure it's the correct length
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  
  // Ensure the private key is 64 characters (32 bytes)
  if (privateKey.length > 64) {
    privateKey = privateKey.slice(0, 64);
  } else if (privateKey.length < 64) {
    throw new Error('Private key is too short, should be 64 hex characters');
  }
  
  // Add the 0x prefix back
  privateKey = '0x' + privateKey;
  
  // Connect to Base Sepolia
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
  );
  
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Using wallet address:", wallet.address);
  
  // Check wallet balance
  const balance = await wallet.getBalance();
  const balanceInEth = ethers.utils.formatEther(balance);
  console.log("Wallet balance:", balanceInEth, "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.log("\n⚠️ WARNING: Low balance detected!");
    console.log("You need at least 0.01 ETH on Base Sepolia to deploy contracts.");
    console.log("Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-sepolia-faucet");
    process.exit(1);
  }
  
  // Load the QuizFactory ABI and bytecode
  const fs = require("fs");
  const path = require("path");
  
  // Try to find the artifact file
  let artifactPath;
  const possiblePaths = [
    "./artifacts/contracts/src/QuizFactory.sol/QuizFactory.json",
    "../artifacts/contracts/src/QuizFactory.sol/QuizFactory.json",
    path.join(__dirname, "../artifacts/contracts/src/QuizFactory.sol/QuizFactory.json")
  ];
  
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        artifactPath = p;
        break;
      }
    } catch (err) {}
  }
  
  if (!artifactPath) {
    // If artifacts aren't found, try to compile
    console.log("Artifacts not found, attempting to compile contracts...");
    const { execSync } = require("child_process");
    try {
      execSync("npx hardhat compile", { stdio: "inherit" });
      // Try paths again
      for (const p of possiblePaths) {
        try {
          if (fs.existsSync(p)) {
            artifactPath = p;
            break;
          }
        } catch (err) {}
      }
    } catch (err) {
      console.error("Failed to compile contracts:", err.message);
    }
  }
  
  if (!artifactPath) {
    throw new Error("Could not find QuizFactory artifact. Make sure contracts are compiled.");
  }
  
  console.log("Using artifact at:", artifactPath);
  const quizFactoryJson = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  // Create contract factory
  const QuizFactory = new ethers.ContractFactory(
    quizFactoryJson.abi,
    quizFactoryJson.bytecode,
    wallet
  );
  
  console.log("Deploying QuizFactory contract to Base Sepolia...");
  
  // Deploy the contract with a gas price of 1 gwei
  const quizFactory = await QuizFactory.deploy({
    gasPrice: ethers.utils.parseUnits("1", "gwei")
  });
  
  console.log("Deployment transaction sent:", quizFactory.deployTransaction.hash);
  console.log("Waiting for confirmation...");
  
  // Wait for deployment to complete
  await quizFactory.deployed();
  
  console.log("✅ QuizFactory deployed to:", quizFactory.address);
  console.log("Transaction hash:", quizFactory.deployTransaction.hash);
  
  // Wait for 5 confirmations for better reliability
  console.log("Waiting for 5 confirmations...");
  await quizFactory.deployTransaction.wait(5);
  
  console.log("✅ Deployment confirmed with 5 blocks!");
  
  return quizFactory;
}

// Execute the deployment
main()
  .then((quizFactory) => {
    console.log("📝 Update your .env file with:");
    console.log(`QUIZ_FACTORY_ADDRESS=${quizFactory.address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
