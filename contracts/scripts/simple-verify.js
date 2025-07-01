/**
 * Simple verification script for the QuizFactory contract
 * 
 * This script performs basic read-only verification of the deployed QuizFactory contract.
 */

const { ethers } = require("ethers");
require('dotenv').config({ path: '../.env' });
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Performing basic verification of QuizFactory contract on Base Sepolia...");
  
  // Connect to Base Sepolia
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
  );
  
  // Get the QuizFactory address from .env
  const quizFactoryAddress = process.env.QUIZ_FACTORY_ADDRESS;
  if (!quizFactoryAddress) {
    throw new Error("QUIZ_FACTORY_ADDRESS not found in .env file");
  }
  
  // Load the QuizFactory ABI
  const quizFactoryArtifactPath = path.join(__dirname, "../artifacts/contracts/src/QuizFactory.sol/QuizFactory.json");
  const quizFactoryJson = JSON.parse(fs.readFileSync(quizFactoryArtifactPath, "utf8"));
  
  // Connect to the QuizFactory contract (read-only)
  const quizFactory = new ethers.Contract(
    quizFactoryAddress,
    quizFactoryJson.abi,
    provider
  );
  
  console.log("Connected to QuizFactory at:", quizFactoryAddress);
  
  // Verify the contract has code
  const code = await provider.getCode(quizFactoryAddress);
  if (code === '0x') {
    console.log("❌ No contract found at the specified address");
    return;
  } else {
    console.log("✅ Contract exists at the specified address");
  }
  
  // Check basic functions
  try {
    // 1. Check the owner
    const owner = await quizFactory.owner();
    console.log("Owner:", owner);
    
    // 2. Check if the contract has events
    const filter = quizFactory.filters.QuizEscrowCreated();
    const events = await quizFactory.queryFilter(filter);
    console.log("Number of QuizEscrowCreated events:", events.length);
    
    if (events.length > 0) {
      console.log("\nMost recent quiz escrows created:");
      // Display the most recent 5 quizzes
      const recentEvents = events.slice(-5);
      for (const event of recentEvents) {
        console.log("- Quiz ID:", event.args.quizId);
        console.log("  Escrow address:", event.args.escrowAddress);
        console.log("  Created in block:", event.blockNumber);
      }
    }
    
    console.log("\n✅ Basic contract verification successful!");
    
  } catch (error) {
    console.error("❌ Error verifying contract:", error.message);
    return;
  }
}

// Execute the verification
main()
  .then(() => {
    console.log("\nNext steps:");
    console.log("1. Test the integration with your Discord bot using the /ask command");
    console.log("2. Monitor on-chain events when users interact with quizzes");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
