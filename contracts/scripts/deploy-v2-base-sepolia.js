/**
 * Deploy MotherFactory v2 with Bot-Only Restriction to Base Sepolia
 * 
 * This script deploys a completely new MotherFactory system with:
 * - Bot-only deployment restriction in MotherFactory
 * - Correct Discord bot authorization in QuizHandler
 * - Clean separation between deployment wallet and bot wallet
 * 
 * Usage: npx hardhat run contracts/scripts/deploy-v2-base-sepolia.js --network baseSepolia
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying MotherFactory v2 with Bot-Only Restriction");
  console.log("======================================================");
  
  // Wallet addresses - CLEARLY SEPARATED
  const DEPLOYMENT_WALLET = "0x669ae74656b538c9a96205f8f4073d258eb4c85f";  // From DEPLOYMENT_PK (pays gas)
  const DISCORD_BOT_WALLET = "0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee";   // Discord bot (authorized user)
  
  console.log("🏭 Deployment Wallet (pays gas):", DEPLOYMENT_WALLET);
  console.log("🤖 Discord Bot Wallet (authorized user):", DISCORD_BOT_WALLET);
  console.log("🌐 Network:", hre.network.name);
  
  if (hre.network.name !== "baseSepolia") {
    throw new Error("❌ This script must be run on Base Sepolia network");
  }
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("\n👤 Deployer address:", deployer.address);
  
  if (deployer.address.toLowerCase() !== DEPLOYMENT_WALLET.toLowerCase()) {
    throw new Error("❌ Deployer mismatch! Expected: " + DEPLOYMENT_WALLET);
  }
  
  // Check balance
  const balance = await deployer.getBalance();
  console.log("💰 Deployer balance:", ethers.utils.formatEther(balance), "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    throw new Error("❌ Insufficient balance! Need at least 0.01 ETH for deployment");
  }
  
  // Track deployment info
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    version: "v2",
    deploymentWallet: DEPLOYMENT_WALLET,
    discordBotWallet: DISCORD_BOT_WALLET,
    contracts: {},
    gasUsed: {},
    features: [
      "Bot-only deployment restriction",
      "Correct Discord bot authorization",
      "Upgradeable proxy architecture"
    ]
  };
  
  let totalGasUsed = ethers.BigNumber.from(0);
  
  // ============ STEP 1: DEPLOY PROXY ADMIN ============
  console.log("\n📦 Step 1: Deploy ProxyAdmin");
  console.log("──────────────────────────────");
  
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy(deployer.address); // deployer is initial owner
  const proxyAdminReceipt = await proxyAdmin.deployTransaction.wait();
  
  console.log("✅ ProxyAdmin deployed at:", proxyAdmin.address);
  console.log("⛽ Gas used:", proxyAdminReceipt.gasUsed.toString());
  
  deploymentInfo.contracts.proxyAdmin = proxyAdmin.address;
  deploymentInfo.gasUsed.proxyAdmin = proxyAdminReceipt.gasUsed.toString();
  totalGasUsed = totalGasUsed.add(proxyAdminReceipt.gasUsed);
  
  // ============ STEP 2: DEPLOY MOTHERFACTORY LOGIC ============
  console.log("\n📦 Step 2: Deploy MotherFactory Logic");
  console.log("─────────────────────────────────────");
  
  const MotherFactory = await ethers.getContractFactory("MotherFactory");
  const motherFactoryLogic = await MotherFactory.deploy();
  const motherFactoryLogicReceipt = await motherFactoryLogic.deployTransaction.wait();
  
  console.log("✅ MotherFactory Logic deployed at:", motherFactoryLogic.address);
  console.log("⛽ Gas used:", motherFactoryLogicReceipt.gasUsed.toString());
  
  deploymentInfo.contracts.motherFactoryLogic = motherFactoryLogic.address;
  deploymentInfo.gasUsed.motherFactoryLogic = motherFactoryLogicReceipt.gasUsed.toString();
  totalGasUsed = totalGasUsed.add(motherFactoryLogicReceipt.gasUsed);
  
  // ============ STEP 3: DEPLOY MOTHERFACTORY PROXY ============
  console.log("\n🎭 Step 3: Deploy MotherFactory Proxy");
  console.log("────────────────────────────────────");
  
  // Encode initialization data with DISCORD BOT WALLET
  const initData = MotherFactory.interface.encodeFunctionData("initialize", [DISCORD_BOT_WALLET]);
  
  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const motherFactoryProxy = await TransparentUpgradeableProxy.deploy(
    motherFactoryLogic.address,
    proxyAdmin.address,
    initData
  );
  const motherFactoryProxyReceipt = await motherFactoryProxy.deployTransaction.wait();
  
  console.log("✅ MotherFactory Proxy deployed at:", motherFactoryProxy.address);
  console.log("⛽ Gas used:", motherFactoryProxyReceipt.gasUsed.toString());
  
  deploymentInfo.contracts.motherFactory = motherFactoryProxy.address;
  deploymentInfo.gasUsed.motherFactoryProxy = motherFactoryProxyReceipt.gasUsed.toString();
  totalGasUsed = totalGasUsed.add(motherFactoryProxyReceipt.gasUsed);
  
  // Get proxy instance as MotherFactory
  const motherFactory = MotherFactory.attach(motherFactoryProxy.address);
  
  // ============ STEP 4: VERIFY MOTHERFACTORY INITIALIZATION ============
  console.log("\n🔍 Step 4: Verify MotherFactory Configuration");
  console.log("───────────────────────────────────────────────");
  
  const owner = await motherFactory.owner();
  const authorizedBot = await motherFactory.authorizedBot();
  
  console.log("Owner:", owner);
  console.log("Expected:", deployer.address);
  console.log("Owner Check:", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅ CORRECT" : "❌ INCORRECT");
  
  console.log("\nAuthorized Bot:", authorizedBot);
  console.log("Expected:", DISCORD_BOT_WALLET);
  console.log("Bot Check:", authorizedBot.toLowerCase() === DISCORD_BOT_WALLET.toLowerCase() ? "✅ CORRECT" : "❌ INCORRECT");
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase() || 
      authorizedBot.toLowerCase() !== DISCORD_BOT_WALLET.toLowerCase()) {
    throw new Error("❌ MotherFactory initialization verification failed!");
  }
  
  // ============ STEP 5: DEPLOY QUIZHANDLER LOGIC ============
  console.log("\n📦 Step 5: Deploy QuizHandler Logic");
  console.log("───────────────────────────────────");
  
  const QuizHandler = await ethers.getContractFactory("QuizHandler");
  const quizHandlerLogic = await QuizHandler.deploy();
  const quizHandlerLogicReceipt = await quizHandlerLogic.deployTransaction.wait();
  
  console.log("✅ QuizHandler Logic deployed at:", quizHandlerLogic.address);
  console.log("⛽ Gas used:", quizHandlerLogicReceipt.gasUsed.toString());
  
  deploymentInfo.contracts.quizHandlerLogic = quizHandlerLogic.address;
  deploymentInfo.gasUsed.quizHandlerLogic = quizHandlerLogicReceipt.gasUsed.toString();
  totalGasUsed = totalGasUsed.add(quizHandlerLogicReceipt.gasUsed);
  
  // ============ STEP 6: DEPLOY QUIZHANDLER PROXY ============
  console.log("\n🎭 Step 6: Deploy QuizHandler Proxy");
  console.log("──────────────────────────────────");
  
  // Encode initialization data with DISCORD BOT WALLET
  const quizHandlerInitData = QuizHandler.interface.encodeFunctionData("initialize", [DISCORD_BOT_WALLET]);
  
  const quizHandlerProxy = await TransparentUpgradeableProxy.deploy(
    quizHandlerLogic.address,
    proxyAdmin.address,
    quizHandlerInitData
  );
  const quizHandlerProxyReceipt = await quizHandlerProxy.deployTransaction.wait();
  
  console.log("✅ QuizHandler Proxy deployed at:", quizHandlerProxy.address);
  console.log("⛽ Gas used:", quizHandlerProxyReceipt.gasUsed.toString());
  
  deploymentInfo.contracts.quizHandler = quizHandlerProxy.address;
  deploymentInfo.gasUsed.quizHandlerProxy = quizHandlerProxyReceipt.gasUsed.toString();
  totalGasUsed = totalGasUsed.add(quizHandlerProxyReceipt.gasUsed);
  
  // Get proxy instance as QuizHandler
  const quizHandler = QuizHandler.attach(quizHandlerProxy.address);
  
  // ============ STEP 7: VERIFY QUIZHANDLER INITIALIZATION ============
  console.log("\n🔍 Step 7: Verify QuizHandler Configuration");
  console.log("─────────────────────────────────────────────");
  
  const quizHandlerBot = await quizHandler.authorizedBot();
  console.log("QuizHandler Authorized Bot:", quizHandlerBot);
  console.log("Expected:", DISCORD_BOT_WALLET);
  console.log("QuizHandler Bot Check:", quizHandlerBot.toLowerCase() === DISCORD_BOT_WALLET.toLowerCase() ? "✅ CORRECT" : "❌ INCORRECT");
  
  if (quizHandlerBot.toLowerCase() !== DISCORD_BOT_WALLET.toLowerCase()) {
    throw new Error("❌ QuizHandler initialization verification failed!");
  }
  
  // ============ STEP 8: REGISTER QUIZHANDLER WITH MOTHERFACTORY ============
  console.log("\n🔗 Step 8: Register QuizHandler with MotherFactory");
  console.log("─────────────────────────────────────────────────────");
  
  const registerTx = await motherFactory.registerHandler("QuizEscrow", quizHandlerProxy.address);
  const registerReceipt = await registerTx.wait();
  
  console.log("✅ QuizHandler registered for contract type 'QuizEscrow'");
  console.log("⛽ Gas used:", registerReceipt.gasUsed.toString());
  
  deploymentInfo.gasUsed.registration = registerReceipt.gasUsed.toString();
  totalGasUsed = totalGasUsed.add(registerReceipt.gasUsed);
  
  // Verify registration
  const registeredHandler = await motherFactory.handlers("QuizEscrow");
  console.log("Registered Handler:", registeredHandler);
  console.log("Expected:", quizHandlerProxy.address);
  console.log("Registration Check:", registeredHandler.toLowerCase() === quizHandlerProxy.address.toLowerCase() ? "✅ CORRECT" : "❌ INCORRECT");
  
  if (registeredHandler.toLowerCase() !== quizHandlerProxy.address.toLowerCase()) {
    throw new Error("❌ Handler registration verification failed!");
  }
  
  // ============ FINAL CALCULATIONS ============
  const finalBalance = await deployer.getBalance();
  const totalCost = balance.sub(finalBalance);
  
  deploymentInfo.gasUsed.total = totalGasUsed.toString();
  deploymentInfo.costInEth = ethers.utils.formatEther(totalCost);
  
  console.log("\n" + "=".repeat(60));
  console.log("🎉 MOTHERFACTORY v2 DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log("✅ All contracts deployed and configured");
  console.log("✅ Bot-only deployment restriction active");
  console.log("✅ Discord bot correctly authorized");
  console.log("✅ Handler registration complete");
  
  console.log("\n📊 Deployment Summary:");
  console.log("─────────────────────");
  console.log("MotherFactory (Proxy):", motherFactoryProxy.address);
  console.log("QuizHandler (Proxy):", quizHandlerProxy.address);
  console.log("ProxyAdmin:", proxyAdmin.address);
  console.log("Discord Bot Wallet:", DISCORD_BOT_WALLET);
  console.log("Total Gas Used:", totalGasUsed.toString());
  console.log("Total Cost:", ethers.utils.formatEther(totalCost), "ETH");
  
  // ============ SAVE DEPLOYMENT INFO ============
  console.log("\n💾 Saving Deployment Records");
  console.log("───────────────────────────");
  
  // Save deployment file
  const deploymentPath = path.join(__dirname, "../base-sepolia-deployment-v2.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved:", deploymentPath);
  
  // Backup old deployment if it exists
  const oldDeploymentPath = path.join(__dirname, "../base-sepolia-deployment.json");
  if (fs.existsSync(oldDeploymentPath)) {
    const backupPath = path.join(__dirname, "../base-sepolia-deployment-v1-backup.json");
    fs.copyFileSync(oldDeploymentPath, backupPath);
    console.log("✅ Old deployment backed up:", backupPath);
  }
  
  // Create updated addresses file for bot integration
  const addressesFile = {
    version: "v2",
    network: "baseSepolia",
    motherFactory: motherFactoryProxy.address,
    quizHandler: quizHandlerProxy.address,
    discordBot: DISCORD_BOT_WALLET,
    deploymentWallet: DEPLOYMENT_WALLET,
    features: {
      botOnlyDeployment: true,
      upgradeableProxies: true
    }
  };
  
  const addressesPath = path.join(__dirname, "../deployed-addresses-v2.json");
  fs.writeFileSync(addressesPath, JSON.stringify(addressesFile, null, 2));
  console.log("✅ Address file created:", addressesPath);
  
  console.log("\n🚀 MotherFactory v2 is ready for Discord bot integration!");
  console.log("\n📋 Integration Notes:");
  console.log("1. Only Discord bot can deploy QuizEscrow contracts via MotherFactory");
  console.log("2. QuizEscrow contracts will have Discord bot as authorized result recorder");
  console.log("3. Update bot environment variables with new contract addresses");
  console.log("4. Run verification tests to confirm functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
