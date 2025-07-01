/**
 * Manual Deployment Script for QuizFactory Contract
 * 
 * This script can be used to deploy the QuizFactory contract to any network
 * configured in hardhat.config.js. It outputs the deployed contract address
 * for future reference.
 * 
 * Usage:
 * npx hardhat run contracts/scripts/deploy.js --network <network-name>
 * 
 * Example:
 * npx hardhat run contracts/scripts/deploy.js --network baseGoerli
 */

const hre = require("hardhat");

async function main() {
  console.log("Deploying QuizFactory contract...");

  // Get the contract factory
  const QuizFactory = await hre.ethers.getContractFactory("QuizFactory");
  
  // Deploy the contract
  const quizFactory = await QuizFactory.deploy();
  
  // Wait for deployment to complete
  await quizFactory.deployed();

  console.log("QuizFactory deployed to:", quizFactory.address);
  console.log("Deployment transaction hash:", quizFactory.deployTransaction.hash);
  
  // Verify contract on etherscan if not on a local network
  const networkName = hre.network.name;
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("Waiting for block confirmations...");
    
    // Wait for 6 confirmations to ensure the contract is mined
    await quizFactory.deployTransaction.wait(6);
    
    console.log("Verifying contract on explorer...");
    try {
      await hre.run("verify:verify", {
        address: quizFactory.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Error verifying contract:", error.message);
    }
  }

  return quizFactory.address;
}

// Execute the deployment
main()
  .then((address) => {
    console.log("Deployment successful!");
    console.log("QUIZ_FACTORY_ADDRESS=" + address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
