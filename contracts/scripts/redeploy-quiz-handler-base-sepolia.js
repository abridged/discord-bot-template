/**
 * Redeploy QuizHandler with correct bot wallet on Base Sepolia
 * 
 * This script fixes the incorrect bot wallet configuration by:
 * 1. Deploying a new QuizHandler with the correct bot wallet
 * 2. Updating MotherFactory registration to use the new handler
 * 3. Updating deployment records
 * 
 * Usage: npx hardhat run contracts/scripts/redeploy-quiz-handler-base-sepolia.js --network baseSepolia
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔄 Redeploying QuizHandler with Correct Bot Wallet");
  console.log("==================================================");
  
  // Correct wallet addresses
  const DEPLOYMENT_WALLET = "0x669ae74656b538c9a96205f8f4073d258eb4c85f";  // From DEPLOYMENT_PK
  const CORRECT_BOT_WALLET = "0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee";   // Actual bot wallet
  
  console.log("🏭 Deployment Wallet:", DEPLOYMENT_WALLET);
  console.log("🤖 Bot Wallet (correct):", CORRECT_BOT_WALLET);
  
  // Load existing deployment
  const deploymentPath = path.join(__dirname, "../base-sepolia-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("❌ Original deployment file not found");
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  console.log("📋 Loaded existing deployment info");
  
  // Get existing contract addresses
  const motherFactoryAddress = deployment.contracts.motherFactory;
  const proxyAdminAddress = deployment.contracts.proxyAdmin;
  const oldQuizHandlerAddress = deployment.contracts.quizHandler;
  
  console.log("\n📍 Existing Addresses:");
  console.log("MotherFactory:", motherFactoryAddress);
  console.log("ProxyAdmin:", proxyAdminAddress);
  console.log("Old QuizHandler:", oldQuizHandlerAddress);
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("\n👤 Deployer:", deployer.address);
  
  if (deployer.address.toLowerCase() !== DEPLOYMENT_WALLET.toLowerCase()) {
    throw new Error("❌ Deployer mismatch! Expected: " + DEPLOYMENT_WALLET);
  }
  
  // Deploy new QuizHandler logic contract
  console.log("\n📦 Step 1: Deploy New QuizHandler Logic");
  console.log("─────────────────────────────────────────────");
  
  const QuizHandler = await ethers.getContractFactory("QuizHandler");
  const newQuizHandlerLogic = await QuizHandler.deploy();
  await newQuizHandlerLogic.deployed();
  
  console.log("✅ New QuizHandler Logic deployed at:", newQuizHandlerLogic.address);
  
  // Deploy new proxy for QuizHandler
  console.log("\n🎭 Step 2: Deploy New QuizHandler Proxy");
  console.log("────────────────────────────────────────");
  
  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  
  // Encode initialization data with CORRECT bot wallet
  const initData = QuizHandler.interface.encodeFunctionData("initialize", [CORRECT_BOT_WALLET]);
  
  const newQuizHandlerProxy = await TransparentUpgradeableProxy.deploy(
    newQuizHandlerLogic.address,
    proxyAdminAddress,
    initData
  );
  await newQuizHandlerProxy.deployed();
  
  console.log("✅ New QuizHandler Proxy deployed at:", newQuizHandlerProxy.address);
  
  // Get proxy instance as QuizHandler
  const newQuizHandler = QuizHandler.attach(newQuizHandlerProxy.address);
  
  // Verify initialization
  console.log("\n🔍 Step 3: Verify New QuizHandler Configuration");
  console.log("─────────────────────────────────────────────────");
  
  const authorizedBot = await newQuizHandler.authorizedBot();
  console.log("Authorized Bot in New Handler:", authorizedBot);
  console.log("Expected Bot Wallet:", CORRECT_BOT_WALLET);
  console.log("Verification:", authorizedBot.toLowerCase() === CORRECT_BOT_WALLET.toLowerCase() ? "✅ CORRECT" : "❌ INCORRECT");
  
  if (authorizedBot.toLowerCase() !== CORRECT_BOT_WALLET.toLowerCase()) {
    throw new Error("❌ Bot wallet verification failed!");
  }
  
  // Update MotherFactory registration
  console.log("\n🔗 Step 4: Update MotherFactory Registration");
  console.log("───────────────────────────────────────────────");
  
  const MotherFactory = await ethers.getContractFactory("MotherFactory");
  const motherFactory = MotherFactory.attach(motherFactoryAddress);
  
  // Remove old handler
  console.log("📤 Removing old QuizHandler registration...");
  const removeTx = await motherFactory.removeHandler("QuizEscrow");
  await removeTx.wait();
  console.log("✅ Old QuizHandler removed");
  
  // Register new handler
  console.log("📥 Registering new QuizHandler...");
  const registerTx = await motherFactory.registerHandler("QuizEscrow", newQuizHandlerProxy.address);
  await registerTx.wait();
  console.log("✅ New QuizHandler registered");
  
  // Verify registration
  const registeredHandler = await motherFactory.handlers("QuizEscrow");
  console.log("Registered Handler:", registeredHandler);
  console.log("Expected:", newQuizHandlerProxy.address);
  console.log("Registration Verification:", registeredHandler.toLowerCase() === newQuizHandlerProxy.address.toLowerCase() ? "✅ CORRECT" : "❌ INCORRECT");
  
  // Update deployment file
  console.log("\n💾 Step 5: Update Deployment Records");
  console.log("──────────────────────────────────────");
  
  const updatedDeployment = {
    ...deployment,
    timestamp: new Date().toISOString(),
    contracts: {
      ...deployment.contracts,
      quizHandler: newQuizHandlerProxy.address,
      quizHandlerLogic: newQuizHandlerLogic.address,
      oldQuizHandler: oldQuizHandlerAddress // Keep for reference
    },
    botWallet: CORRECT_BOT_WALLET, // Update with correct bot wallet
    deploymentWallet: DEPLOYMENT_WALLET,
    corrections: {
      reason: "Fixed incorrect bot wallet authorization",
      oldBotWallet: deployment.botWallet,
      newBotWallet: CORRECT_BOT_WALLET,
      oldQuizHandler: oldQuizHandlerAddress,
      newQuizHandler: newQuizHandlerProxy.address
    }
  };
  
  // Save updated deployment
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedDeployment, null, 2));
  console.log("✅ Updated deployment file:", deploymentPath);
  
  // Create backup of old deployment
  const backupPath = path.join(__dirname, "../base-sepolia-deployment-backup.json");
  fs.writeFileSync(backupPath, JSON.stringify(deployment, null, 2));
  console.log("✅ Backup of old deployment saved:", backupPath);
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 QUIZHANDLER REDEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log("✅ New QuizHandler Logic:", newQuizHandlerLogic.address);
  console.log("✅ New QuizHandler Proxy:", newQuizHandlerProxy.address);
  console.log("✅ Authorized Bot (Fixed):", CORRECT_BOT_WALLET);
  console.log("✅ MotherFactory Registration Updated");
  console.log("✅ Deployment Records Updated");
  
  console.log("\n🔧 Updated Addresses for Bot Integration:");
  console.log("─────────────────────────────────────────");
  console.log("MotherFactory:", motherFactoryAddress);
  console.log("QuizHandler:", newQuizHandlerProxy.address);
  console.log("Bot Wallet:", CORRECT_BOT_WALLET);
  
  console.log("\n📋 Next Steps:");
  console.log("1. Update bot environment with new QuizHandler address");
  console.log("2. Run verification tests");
  console.log("3. Test quiz creation from Discord bot");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Redeployment failed:", error);
    process.exit(1);
  });
