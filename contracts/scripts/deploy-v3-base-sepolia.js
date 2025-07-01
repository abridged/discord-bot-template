/**
 * Deploy MotherFactory v3 (User Direct Deploy) to Base Sepolia
 * 
 * Key Changes from v2:
 * - Removed onlyAuthorizedBot restriction from deployContract()
 * - Users can now deploy QuizEscrow contracts directly via MotherFactory
 * - Simplified architecture with single-transaction user experience
 */

const { ethers, upgrades } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('🚀 Deploying MotherFactory v3 (User Direct Deploy) to Base Sepolia...\n');

  // Get deployment wallet
  const [deployer] = await ethers.getSigners();
  console.log('📋 Deployment Details:');
  console.log('   Deployer address:', deployer.address);
  console.log('   Network: Base Sepolia (Chain ID: 84532)');
  
  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log('   Deployer balance:', ethers.utils.formatEther(balance), 'ETH');
  
  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    throw new Error('❌ Insufficient balance for deployment (minimum 0.01 ETH required)');
  }

  console.log('\n🏗️  Step 1: Deploying MotherFactory v3...');
  
  // Deploy MotherFactory v3 with user deployment support
  const MotherFactory = await ethers.getContractFactory('MotherFactory');
  
  // For v3, we still keep the bot address for QuizHandler operations
  // but deployContract() is now open to all users
  const discordBotAddress = process.env.DISCORD_BOT_WALLET || '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee';
  console.log('   Discord bot address:', discordBotAddress);
  
  const motherFactoryProxy = await upgrades.deployProxy(
    MotherFactory,
    [discordBotAddress], // Still used for QuizHandler authorization
    {
      initializer: 'initialize',
      kind: 'transparent'
    }
  );
  
  await motherFactoryProxy.deployed();
  console.log('✅ MotherFactory v3 proxy deployed at:', motherFactoryProxy.address);

  // Get implementation and admin addresses
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(motherFactoryProxy.address);
  const adminAddress = await upgrades.erc1967.getAdminAddress(motherFactoryProxy.address);
  
  console.log('   Implementation address:', implementationAddress);
  console.log('   ProxyAdmin address:', adminAddress);

  console.log('\n🏗️  Step 2: Deploying QuizHandler v3...');
  
  // Deploy QuizHandler v3 (compatible with new MotherFactory)
  const QuizHandler = await ethers.getContractFactory('QuizHandler');
  const quizHandlerProxy = await upgrades.deployProxy(
    QuizHandler,
    [discordBotAddress], // Bot still authorized for result recording
    {
      initializer: 'initialize',
      kind: 'transparent'
    }
  );
  
  await quizHandlerProxy.deployed();
  console.log('✅ QuizHandler v3 proxy deployed at:', quizHandlerProxy.address);

  // Get QuizHandler implementation address
  const quizImplementationAddress = await upgrades.erc1967.getImplementationAddress(quizHandlerProxy.address);
  console.log('   Implementation address:', quizImplementationAddress);

  console.log('\n🔗 Step 3: Registering QuizHandler with MotherFactory...');
  
  // Register QuizHandler with MotherFactory
  const registerTx = await motherFactoryProxy.registerHandler(
    'QuizEscrow',
    quizHandlerProxy.address
  );
  await registerTx.wait();
  console.log('✅ QuizHandler registered for "QuizEscrow" contracts');

  console.log('\n💾 Step 4: Saving deployment records...');
  
  // Save deployment information
  const deploymentRecord = {
    network: 'base-sepolia',
    chainId: 84532,
    version: 'v3',
    timestamp: new Date().toISOString(),
    deployerAddress: deployer.address,
    discordBotAddress: discordBotAddress,
    contracts: {
      MotherFactory: {
        proxy: motherFactoryProxy.address,
        implementation: implementationAddress,
        admin: adminAddress
      },
      QuizHandler: {
        proxy: quizHandlerProxy.address,
        implementation: quizImplementationAddress,
        admin: adminAddress // Same ProxyAdmin for both
      }
    },
    features: {
      userDirectDeploy: true,
      botOnlyRestriction: false,
      upgradeableProxies: true
    },
    notes: [
      'v3 enables user direct deployment of QuizEscrow contracts',
      'Removed onlyAuthorizedBot restriction from deployContract()',
      'Bot address still used for QuizHandler result recording authorization',
      'Single-transaction user experience for deploy + fund'
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

  console.log('\n🎯 Step 5: Deployment Summary');
  console.log('=====================================');
  console.log('✅ MotherFactory v3 (User Deploy):', motherFactoryProxy.address);
  console.log('✅ QuizHandler v3:', quizHandlerProxy.address);
  console.log('✅ ProxyAdmin:', adminAddress);
  console.log('✅ Discord Bot:', discordBotAddress);
  console.log('\n🆕 New Features:');
  console.log('   • Users can deploy QuizEscrow contracts directly');
  console.log('   • Single-transaction deploy + fund experience');
  console.log('   • Simplified architecture without bot intermediary');
  console.log('\n📋 Next Steps:');
  console.log('   1. Update .env with new contract addresses');
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
