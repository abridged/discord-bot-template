/**
 * Deployment Script for MotherFactory & QuizHandler Proxy Contracts on Base Sepolia
 * 
 * This script deploys the complete proxy architecture to Base Sepolia testnet:
 * - MotherFactory (TransparentUpgradeableProxy)
 * - QuizHandler (TransparentUpgradeableProxy)
 * - All logic contracts and proxy setup
 * 
 * Usage:
 * npx hardhat run contracts/scripts/deploy-base-sepolia.js --network baseSepolia
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  // Get the signer from Hardhat (will use the private key from .env through hardhat.config.js)
  const [deployer] = await ethers.getSigners();
  console.log("Using deployment address:", deployer.address);
  console.log("Deploying MotherFactory & QuizHandler proxy contracts to Base Sepolia...");
  console.log("Network:", hre.network.name);

  // Ensure we're on the right network
  if (hre.network.name !== "baseSepolia") {
    console.warn("⚠️  Warning: You're not on the Base Sepolia network!");
    console.warn("Using network:", hre.network.name);
    // Give the user a chance to abort
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Deployer balance:", ethers.utils.formatEther(balance), "ETH");
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    throw new Error("❌ Insufficient balance for deployment. Need at least 0.01 ETH");
  }

  // Setup for proxy deployment
  const botWallet = deployer.address; // In production, this should be the dedicated bot wallet
  console.log("Bot wallet (authorized for quiz operations):", botWallet);

  console.log("\n=== Step 1: Deploy Logic Contracts ===");
  
  // Deploy MotherFactory logic contract
  console.log("Deploying MotherFactory logic contract...");
  const MotherFactory = await ethers.getContractFactory("MotherFactory", deployer);
  const motherFactoryLogic = await MotherFactory.deploy();
  await motherFactoryLogic.deployed();
  console.log("✅ MotherFactory logic deployed to:", motherFactoryLogic.address);

  // Deploy QuizHandler logic contract
  console.log("Deploying QuizHandler logic contract...");
  const QuizHandler = await ethers.getContractFactory("QuizHandler", deployer);
  const quizHandlerLogic = await QuizHandler.deploy(); 
  await quizHandlerLogic.deployed();
  console.log("✅ QuizHandler logic deployed to:", quizHandlerLogic.address);

  console.log("\n=== Step 2: Deploy Proxy Contracts ===");
  
  // Deploy ProxyAdmin
  console.log("Deploying ProxyAdmin...");
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin", deployer);
  const proxyAdmin = await ProxyAdmin.deploy(deployer.address); 
  await proxyAdmin.deployed();
  console.log("✅ ProxyAdmin deployed to:", proxyAdmin.address);

  // Deploy MotherFactory Proxy
  console.log("Deploying MotherFactory proxy...");
  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy", deployer);
  
  // Encode the initialize call for MotherFactory
  const motherFactoryInitData = MotherFactory.interface.encodeFunctionData("initialize", []); 
  
  const motherFactoryProxy = await TransparentUpgradeableProxy.deploy(
    motherFactoryLogic.address,
    proxyAdmin.address,
    motherFactoryInitData
  );
  await motherFactoryProxy.deployed();
  console.log("✅ MotherFactory proxy deployed to:", motherFactoryProxy.address);

  // Deploy QuizHandler Proxy
  console.log("Deploying QuizHandler proxy...");
  
  // Encode the initialize call for QuizHandler
  const quizHandlerInitData = QuizHandler.interface.encodeFunctionData("initialize", [botWallet]);
  
  const quizHandlerProxy = await TransparentUpgradeableProxy.deploy(
    quizHandlerLogic.address,
    proxyAdmin.address,
    quizHandlerInitData 
  );
  await quizHandlerProxy.deployed();
  console.log("✅ QuizHandler proxy deployed to:", quizHandlerProxy.address);

  console.log("\n=== Step 3: Setup Contract Interactions ===");
  
  // Get contract instances pointing to proxies
  const motherFactory = MotherFactory.attach(motherFactoryProxy.address);
  const quizHandler = QuizHandler.attach(quizHandlerProxy.address);

  // Register QuizHandler with MotherFactory
  console.log("Registering QuizHandler with MotherFactory...");
  const registerTx = await motherFactory.connect(deployer).registerHandler("QuizEscrow", quizHandler.address);
  await registerTx.wait();
  console.log("✅ QuizHandler registered successfully");

  // Verify registration
  const isActive = await motherFactory.isHandlerActive("QuizEscrow");
  console.log("Handler registration verified:", isActive);

  console.log("\n=== Step 4: Save Deployment Information ===");
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: await deployer.getChainId(),
    deployer: deployer.address,
    botWallet: botWallet,
    timestamp: new Date().toISOString(),
    contracts: {
      // Logic contracts
      motherFactoryLogic: motherFactoryLogic.address,
      quizHandlerLogic: quizHandlerLogic.address,
      
      // Proxy infrastructure
      proxyAdmin: proxyAdmin.address,
      
      // Main contracts (proxies)
      motherFactory: motherFactoryProxy.address,
      quizHandler: quizHandlerProxy.address
    },
    transactions: {
      motherFactoryLogic: motherFactoryLogic.deployTransaction.hash,
      quizHandlerLogic: quizHandlerLogic.deployTransaction.hash,
      proxyAdmin: proxyAdmin.deployTransaction.hash,
      motherFactoryProxy: motherFactoryProxy.deployTransaction.hash,
      quizHandlerProxy: quizHandlerProxy.deployTransaction.hash,
      handlerRegistration: registerTx.hash
    }
  };

  // Save to file
  const deploymentPath = path.join(__dirname, "../base-sepolia-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", deploymentPath);

  // Update deployed addresses registry
  const addressRegistryPath = path.join(__dirname, "../deployed-addresses.json");
  let addressRegistry = {};
  
  // Load existing registry or create new one
  try {
    if (fs.existsSync(addressRegistryPath)) {
      addressRegistry = JSON.parse(fs.readFileSync(addressRegistryPath, 'utf8'));
    }
  } catch (error) {
    console.log("Creating new address registry...");
    addressRegistry = { networks: {} };
  }

  // Ensure baseSepolia network exists
  if (!addressRegistry.networks) addressRegistry.networks = {};
  if (!addressRegistry.networks.baseSepolia) {
    addressRegistry.networks.baseSepolia = {
      chainId: 84532,
      contracts: {},
      lastDeployment: null
    };
  }

  // Update addresses
  addressRegistry.networks.baseSepolia.contracts = {
    motherFactory: motherFactoryProxy.address,
    quizHandler: quizHandlerProxy.address,
    proxyAdmin: proxyAdmin.address,
    // Include logic contracts for reference
    motherFactoryLogic: motherFactoryLogic.address,
    quizHandlerLogic: quizHandlerLogic.address
  };
  addressRegistry.networks.baseSepolia.lastDeployment = deploymentInfo.timestamp;

  // Save updated registry
  fs.writeFileSync(addressRegistryPath, JSON.stringify(addressRegistry, null, 2));
  console.log("✅ Address registry updated:", addressRegistryPath);

  console.log("\n=== Step 5: Contract Verification ===");
  
  // Check if BaseScan API key is available
  const baseScanApiKey = process.env.BASESCAN_API_KEY;
  if (!baseScanApiKey) {
    console.log("⚠️  BASESCAN_API_KEY not found - skipping contract verification");
    console.log("ℹ️  Contracts will work fine but won't be verified on BaseScan");
    console.log("ℹ️  Add BASESCAN_API_KEY to .env and re-run verification manually later if needed");
  } else {
    console.log("Waiting for block confirmations before verification...");
    
    // Wait for confirmations
    await motherFactoryLogic.deployTransaction.wait(5);
    await quizHandlerLogic.deployTransaction.wait(5);
    await proxyAdmin.deployTransaction.wait(5);
    
    // Verify logic contracts
    console.log("Verifying contracts on Base Sepolia Explorer...");
    
    try {
      console.log("Verifying MotherFactory logic...");
      await hre.run("verify:verify", {
        address: motherFactoryLogic.address,
        constructorArguments: [],
        contract: "contracts/src/MotherFactory.sol:MotherFactory"
      });
      console.log("✅ MotherFactory logic verified");
    } catch (error) {
      console.error("❌ Error verifying MotherFactory logic:", error.message);
    }

    try {
      console.log("Verifying QuizHandler logic...");
      await hre.run("verify:verify", {
        address: quizHandlerLogic.address,
        constructorArguments: [],
        contract: "contracts/src/QuizHandler.sol:QuizHandler"
      });
      console.log("✅ QuizHandler logic verified");
    } catch (error) {
      console.error("❌ Error verifying QuizHandler logic:", error.message);
    }

    try {
      console.log("Verifying ProxyAdmin...");
      await hre.run("verify:verify", {
        address: proxyAdmin.address,
        constructorArguments: [deployer.address],
      });
      console.log("✅ ProxyAdmin verified");
    } catch (error) {
      console.error("❌ Error verifying ProxyAdmin:", error.message);
    }

    // Note: Proxy contracts are harder to verify due to constructor complexity
    console.log("⚠️  Proxy contract verification may need manual steps on Basescan");
  }

  console.log("\n=== 🎉 Deployment Complete! ===");
  console.log("MotherFactory (proxy):", motherFactoryProxy.address);
  console.log("QuizHandler (proxy):", quizHandlerProxy.address);
  console.log("Bot wallet:", botWallet);
  console.log("Network:", hre.network.name);
  console.log("\nNext steps:");
  console.log("1. Update bot configuration with these contract addresses");
  console.log("2. Test contract interactions");
  console.log("3. Set up Collab.Land Account Kit integration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
