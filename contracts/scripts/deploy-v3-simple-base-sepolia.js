/**
 * Deploy MotherFactory v3 (User Direct Deploy) to Base Sepolia - Simple Version
 * 
 * Key Changes from v2:
 * - Removed onlyAuthorizedBot restriction from deployContract()
 * - Users can now deploy QuizEscrow contracts directly via MotherFactory
 * - Uses simple deployment (non-upgradeable) to avoid ethers v6 dependency conflicts
 */

const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('🚀 Deploying MotherFactory v3 (User Direct Deploy) to Base Sepolia...\n');

  // Get deployment wallet
  const [deployer] = await ethers.getSigners();
  console.log('📋 Deployment Details:');
  console.log('   Deployer address:', deployer.address);
  console.log('   Network: Base Sepolia (Chain ID: 84532)');
  
  // Verify we're using the correct wallet
  const expectedWallet = '0x669ae74656B538c9a96205f8f4073d258EB4C85F';
  if (deployer.address.toLowerCase() !== expectedWallet.toLowerCase()) {
    throw new Error(`❌ Wrong deployment wallet! Expected: ${expectedWallet}, Got: ${deployer.address}`);
  }
  console.log('✅ Using correct deployment wallet');
  
  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log('   Deployer balance:', ethers.utils.formatEther(balance), 'ETH');
  
  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    throw new Error('❌ Insufficient balance for deployment (minimum 0.01 ETH required)');
  }

  console.log('\n🏗️  Step 1: Deploying MotherFactory v3...');
  
  // Deploy MotherFactory v3 (simple deployment, no upgrades)
  const MotherFactory = await ethers.getContractFactory('MotherFactory');
  
  // For v3, we still keep the bot address for QuizHandler operations
  // but deployContract() is now open to all users
  const discordBotAddress = process.env.DISCORD_BOT_WALLET || '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee';
  console.log('   Discord bot address:', discordBotAddress);
  
  const motherFactory = await MotherFactory.deploy();
  await motherFactory.deployed();
  
  // Initialize the contract (call initialize function manually)
  const initTx = await motherFactory.initialize(discordBotAddress);
  await initTx.wait();
  
  console.log('✅ MotherFactory v3 deployed at:', motherFactory.address);

  console.log('\n🏗️  Step 2: Deploying QuizHandler v3...');
  
  // Deploy QuizHandler v3 (simple deployment, no upgrades)
  const QuizHandler = await ethers.getContractFactory('QuizHandler');
  const quizHandler = await QuizHandler.deploy();
  await quizHandler.deployed();
  
  // Initialize QuizHandler
  const quizInitTx = await quizHandler.initialize(discordBotAddress);
  await quizInitTx.wait();
  
  console.log('✅ QuizHandler v3 deployed at:', quizHandler.address);

  console.log('\n🔗 Step 3: Registering QuizHandler with MotherFactory...');
  
  // Register QuizHandler with MotherFactory
  const registerTx = await motherFactory.registerHandler(
    'QuizEscrow',
    quizHandler.address
  );
  await registerTx.wait();
  console.log('✅ QuizHandler registered for "QuizEscrow" contracts');

  console.log('\n🧪 Step 4: Verifying deployment...');
  
  // Verify the deployment worked correctly
  const registeredHandler = await motherFactory.getHandler('QuizEscrow');
  if (registeredHandler !== quizHandler.address) {
    throw new Error('❌ Handler registration failed');
  }
  
  const authorizedBot = await motherFactory.authorizedBot();
  if (authorizedBot !== discordBotAddress) {
    throw new Error('❌ Bot authorization failed');
  }
  
  console.log('✅ All verifications passed');

  console.log('\n💾 Step 5: Saving deployment records...');
  
  // Save deployment information
  const deploymentRecord = {
    network: 'base-sepolia',
    chainId: 84532,
    version: 'v3',
    deploymentType: 'simple', // Not upgradeable
    timestamp: new Date().toISOString(),
    deployerAddress: deployer.address,
    discordBotAddress: discordBotAddress,
    contracts: {
      MotherFactory: {
        address: motherFactory.address,
        deploymentTxHash: motherFactory.deployTransaction.hash
      },
      QuizHandler: {
        address: quizHandler.address,
        deploymentTxHash: quizHandler.deployTransaction.hash
      }
    },
    features: {
      userDirectDeploy: true,
      botOnlyRestriction: false,
      upgradeableProxies: false
    },
    notes: [
      'v3 enables user direct deployment of QuizEscrow contracts',
      'Removed onlyAuthorizedBot restriction from deployContract()',
      'Bot address still used for QuizHandler result recording authorization',
      'Single-transaction user experience for deploy + fund',
      'Simple deployment (non-upgradeable) to avoid ethers v6 conflicts'
    ]
  };

  const fs = require('fs');
  const path = require('path');
  
  // Save to contracts directory
  const contractsRecordPath = path.join(__dirname, '..', 'base-sepolia-deployment-v3.json');
  fs.writeFileSync(contractsRecordPath, JSON.stringify(deploymentRecord, null, 2));
  console.log('📁 Deployment record saved:', contractsRecordPath);
  
  // Save to project root for bot integration
  const rootRecordPath = path.join(__dirname, '..', '..', 'base-sepolia-deployment-v3.json');
  fs.writeFileSync(rootRecordPath, JSON.stringify(deploymentRecord, null, 2));
  console.log('📁 Bot integration record saved:', rootRecordPath);

  console.log('\n🎯 Step 6: Deployment Summary');
  console.log('=====================================');
  console.log('✅ MotherFactory v3 (User Deploy):', motherFactory.address);
  console.log('✅ QuizHandler v3:', quizHandler.address);
  console.log('✅ Discord Bot:', discordBotAddress);
  console.log('✅ Deployment Wallet:', deployer.address);
  
  console.log('\n🆕 New Features:');
  console.log('   • Users can deploy QuizEscrow contracts directly');
  console.log('   • Single-transaction deploy + fund experience');
  console.log('   • Simplified architecture without bot intermediary');
  console.log('   • No ethers v6 dependency conflicts');
  
  console.log('\n📋 Next Steps:');
  console.log('   1. Update .env with new contract addresses:');
  console.log(`      MOTHER_FACTORY_ADDRESS=${motherFactory.address}`);
  console.log(`      QUIZ_HANDLER_ADDRESS=${quizHandler.address}`);
  console.log('   2. Update QuizService to use user Account Kit deployment');
  console.log('   3. Test end-to-end user deployment flow');
  
  console.log('\n🚀 MotherFactory v3 deployment completed successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
