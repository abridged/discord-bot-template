/**
 * Run tests against the deployed QuizFactory contract
 * 
 * This script uses the existing test suite but points it to the 
 * deployed contract on Base Sepolia.
 */

const { ethers } = require("hardhat");
require('dotenv').config({ path: '../.env' });
const chai = require("chai");
const { expect } = chai;

async function main() {
  console.log("Running tests against deployed QuizFactory at:", process.env.QUIZ_FACTORY_ADDRESS);
  
  // Get signers
  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("Using test accounts:");
  console.log("- Deployer:", deployer.address);
  console.log("- User1:", user1.address);
  console.log("- User2:", user2.address);
  
  // Get the factory contract
  const QuizFactory = await ethers.getContractFactory("QuizFactory");
  const quizFactory = QuizFactory.attach(process.env.QUIZ_FACTORY_ADDRESS);
  
  // Deploy a test token for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const testToken = await MockERC20.deploy("Test Token", "TEST");
  await testToken.deployed();
  console.log("Test token deployed at:", testToken.address);
  
  // Mint tokens to the deployer for testing
  const mintAmount = ethers.utils.parseEther("1000");
  await testToken.mint(deployer.address, mintAmount);
  console.log("Minted tokens to deployer:", ethers.utils.formatEther(mintAmount));
  
  // Test 1: Create a quiz escrow
  console.log("\n🧪 Test 1: Create Quiz Escrow");
  const quizId = "test-quiz-" + Date.now();
  const rewardAmount = ethers.utils.parseEther("10");
  const expiryTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
  
  // Approve tokens
  await testToken.approve(quizFactory.address, rewardAmount);
  console.log("Approved tokens for QuizFactory");
  
  // Create quiz escrow
  const tx = await quizFactory.createQuizEscrow(quizId, testToken.address, rewardAmount, expiryTime);
  const receipt = await tx.wait();
  
  // Get the escrow address from the event
  const event = receipt.events.find(e => e.event === 'QuizEscrowCreated');
  const escrowAddress = event.args.escrowAddress;
  console.log("Quiz escrow created at:", escrowAddress);
  
  // Test 2: Verify escrow details
  console.log("\n🧪 Test 2: Verify Escrow Details");
  const QuizEscrow = await ethers.getContractFactory("QuizEscrow");
  const escrow = QuizEscrow.attach(escrowAddress);
  
  const escrowQuizId = await escrow.quizId();
  const escrowToken = await escrow.tokenAddress();
  const escrowReward = await escrow.rewardAmount();
  const escrowExpiry = await escrow.expiryTime();
  
  console.log("Quiz ID:", escrowQuizId);
  console.log("Expected:", quizId);
  console.log("Check:", escrowQuizId === quizId ? "✅ PASS" : "❌ FAIL");
  
  console.log("\nToken address:", escrowToken);
  console.log("Expected:", testToken.address);
  console.log("Check:", escrowToken.toLowerCase() === testToken.address.toLowerCase() ? "✅ PASS" : "❌ FAIL");
  
  console.log("\nReward amount:", ethers.utils.formatEther(escrowReward));
  console.log("Expected:", ethers.utils.formatEther(rewardAmount));
  console.log("Check:", escrowReward.eq(rewardAmount) ? "✅ PASS" : "❌ FAIL");
  
  console.log("\nExpiry time:", new Date(escrowExpiry.toNumber() * 1000).toISOString());
  console.log("Expected:", new Date(expiryTime * 1000).toISOString());
  console.log("Check:", Math.abs(escrowExpiry.toNumber() - expiryTime) < 10 ? "✅ PASS" : "❌ FAIL");
  
  // Test 3: Add answers
  console.log("\n🧪 Test 3: Add Answers");
  await escrow.addAnswer(user1.address, true); // Correct answer
  await escrow.addAnswer(user2.address, false); // Incorrect answer
  
  const user1HasAnswered = await escrow.hasAnswered(user1.address);
  const user2HasAnswered = await escrow.hasAnswered(user2.address);
  
  console.log("User1 has answered:", user1HasAnswered);
  console.log("Expected: true");
  console.log("Check:", user1HasAnswered === true ? "✅ PASS" : "❌ FAIL");
  
  console.log("\nUser2 has answered:", user2HasAnswered);
  console.log("Expected: true");
  console.log("Check:", user2HasAnswered === true ? "✅ PASS" : "❌ FAIL");
  
  // Test 4: Distribute rewards
  console.log("\n🧪 Test 4: Distribute Rewards");
  
  // Fast forward time (this won't work on a live network, but we can try)
  try {
    await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
    await ethers.provider.send("evm_mine");
    console.log("Time fast-forwarded to after expiry (may not work on live networks)");
  } catch (error) {
    console.log("Could not fast-forward time, would need to wait for expiry on live network");
    console.log("Skipping reward distribution test as it requires expired quiz");
    console.log("This part would need to be tested after the quiz expiry time has passed");
    return;
  }
  
  // Try to distribute rewards
  const balanceBefore1 = await testToken.balanceOf(user1.address);
  const balanceBefore2 = await testToken.balanceOf(user2.address);
  
  await escrow.distributeRewards();
  
  const balanceAfter1 = await testToken.balanceOf(user1.address);
  const balanceAfter2 = await testToken.balanceOf(user2.address);
  
  console.log("User1 balance before:", ethers.utils.formatEther(balanceBefore1));
  console.log("User1 balance after:", ethers.utils.formatEther(balanceAfter1));
  console.log("User1 received:", ethers.utils.formatEther(balanceAfter1.sub(balanceBefore1)));
  
  console.log("\nUser2 balance before:", ethers.utils.formatEther(balanceBefore2));
  console.log("User2 balance after:", ethers.utils.formatEther(balanceAfter2));
  console.log("User2 received:", ethers.utils.formatEther(balanceAfter2.sub(balanceBefore2)));
  
  console.log("\n✅ All tests completed!");
}

// Execute tests
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Tests failed:", error);
    process.exit(1);
  });
