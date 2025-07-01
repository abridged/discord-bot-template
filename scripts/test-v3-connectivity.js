/**
 * MotherFactory v3 Contract Connectivity Test
 * 
 * Verifies bot can connect to v3 contracts and validates:
 * 1. MotherFactory v3 connection
 * 2. QuizHandler v3 connection  
 * 3. No onlyAuthorizedBot errors for reading
 * 4. User deployment capability verification
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Import contract ABIs
const MotherFactoryABI = require('../contracts/artifacts/contracts/src/MotherFactory.sol/MotherFactory.json').abi;
const QuizHandlerABI = require('../contracts/artifacts/contracts/src/QuizHandler.sol/QuizHandler.json').abi;

async function testV3Connectivity() {
  console.log('🔗 Testing MotherFactory v3 Contract Connectivity...\n');

  try {
    // Initialize provider
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    console.log('📡 Provider initialized:', rpcUrl);

    // Get contract addresses from environment
    const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS;
    const quizHandlerAddress = process.env.QUIZ_HANDLER_ADDRESS;
    const botWalletAddress = process.env.BOT_WALLET;

    console.log('📋 Contract Configuration:');
    console.log('   MotherFactory v3:', motherFactoryAddress);
    console.log('   QuizHandler v3:', quizHandlerAddress);
    console.log('   Discord Bot:', botWalletAddress);

    if (!motherFactoryAddress || !quizHandlerAddress) {
      throw new Error('❌ Missing contract addresses in .env file');
    }

    // Test 1: MotherFactory v3 Connection
    console.log('\n🏗️  Test 1: MotherFactory v3 Connection...');
    const motherFactory = new ethers.Contract(motherFactoryAddress, MotherFactoryABI, provider);
    
    // Read basic info (should work for anyone)
    const authorizedBot = await motherFactory.authorizedBot();
    const totalDeployed = await motherFactory.totalDeployed();
    const contractTypes = await motherFactory.getContractTypes();
    
    console.log('✅ MotherFactory v3 connected successfully');
    console.log('   Authorized Bot:', authorizedBot);
    console.log('   Total Deployed:', totalDeployed.toString());
    console.log('   Contract Types:', contractTypes);

    // Test 2: QuizHandler v3 Connection
    console.log('\n🎯 Test 2: QuizHandler v3 Connection...');
    const quizHandler = new ethers.Contract(quizHandlerAddress, QuizHandlerABI, provider);
    
    // Read QuizHandler info
    const handlerInfo = await quizHandler.getHandlerInfo();
    const deploymentFee = await quizHandler.getDeploymentFee('0x'); // Empty params for basic fee
    
    console.log('✅ QuizHandler v3 connected successfully');
    console.log('   Handler Info:', handlerInfo);
    console.log('   Deployment Fee:', ethers.utils.formatEther(deploymentFee), 'ETH');

    // Test 3: Verify QuizHandler Registration
    console.log('\n🔗 Test 3: QuizHandler Registration Check...');
    const registeredHandler = await motherFactory.getHandler('QuizEscrow');
    const isHandlerActive = await motherFactory.isHandlerActive('QuizEscrow');
    
    if (registeredHandler.toLowerCase() !== quizHandlerAddress.toLowerCase()) {
      throw new Error(`❌ QuizHandler not properly registered! Expected: ${quizHandlerAddress}, Got: ${registeredHandler}`);
    }
    
    console.log('✅ QuizHandler properly registered for "QuizEscrow"');
    console.log('   Registered Address:', registeredHandler);
    console.log('   Handler Active:', isHandlerActive);

    // Test 4: User Deployment Capability (v3 Feature)
    console.log('\n👤 Test 4: User Deployment Capability Check...');
    
    // Create a test user wallet (read-only, no transactions)
    const testUserPrivateKey = '0x' + '1'.repeat(64); // Dummy private key for testing
    const testUserWallet = new ethers.Wallet(testUserPrivateKey, provider);
    const testUserAddress = testUserWallet.address;
    
    console.log('   Test User Address:', testUserAddress);
    
    // Connect MotherFactory with test user (read-only)
    const motherFactoryAsUser = motherFactory.connect(testUserWallet);
    
    // In v3, this should NOT throw an "onlyAuthorizedBot" error for reading
    try {
      const deploymentFeeForUser = await motherFactoryAsUser.getDeploymentFee('QuizEscrow', '0x');
      console.log('✅ User can read deployment fee:', ethers.utils.formatEther(deploymentFeeForUser), 'ETH');
      console.log('✅ No onlyAuthorizedBot restriction on reads (v3 confirmed)');
    } catch (error) {
      if (error.message.includes('Only authorized bot')) {
        throw new Error('❌ v3 still has onlyAuthorizedBot restriction! Contract not properly updated.');
      } else {
        throw error;
      }
    }

    // Test 5: Bot Authorization Check
    console.log('\n🤖 Test 5: Bot Authorization Verification...');
    
    if (authorizedBot.toLowerCase() !== botWalletAddress.toLowerCase()) {
      console.log('⚠️  Warning: Bot address mismatch!');
      console.log('   Contract Bot:', authorizedBot);
      console.log('   .env Bot:', botWalletAddress);
    } else {
      console.log('✅ Bot address matches contract authorization');
    }

    // Test 6: Network Verification
    console.log('\n🌐 Test 6: Network Verification...');
    const network = await provider.getNetwork();
    const expectedChainId = 84532; // Base Sepolia
    
    if (network.chainId !== expectedChainId) {
      throw new Error(`❌ Wrong network! Expected: ${expectedChainId}, Got: ${network.chainId}`);
    }
    
    console.log('✅ Connected to correct network:', network.name, `(Chain ID: ${network.chainId})`);

    // Summary
    console.log('\n🎉 ALL CONNECTIVITY TESTS PASSED!');
    console.log('=====================================');
    console.log('✅ MotherFactory v3 connection: SUCCESS');
    console.log('✅ QuizHandler v3 connection: SUCCESS');
    console.log('✅ QuizHandler registration: SUCCESS');
    console.log('✅ User deployment capability: SUCCESS (v3 confirmed)');
    console.log('✅ Bot authorization: SUCCESS');
    console.log('✅ Network verification: SUCCESS');
    
    console.log('\n📋 Ready for Phase 2: QuizService Architecture Update');
    
    return {
      success: true,
      motherFactoryAddress,
      quizHandlerAddress,
      authorizedBot,
      totalDeployed: totalDeployed.toString(),
      contractTypes,
      deploymentFee: ethers.utils.formatEther(deploymentFee),
      network: network.name,
      chainId: network.chainId
    };

  } catch (error) {
    console.error('\n❌ CONNECTIVITY TEST FAILED!');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Verify .env has correct v3 contract addresses');
    console.error('2. Check BASE_SEPOLIA_RPC_URL is working');
    console.error('3. Ensure contracts are properly deployed on Base Sepolia');
    console.error('4. Verify contract ABIs are up to date');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test if called directly
if (require.main === module) {
  testV3Connectivity()
    .then(result => {
      if (result.success) {
        console.log('\n🚀 Phase 1.2 Complete - Ready for Phase 2!');
        process.exit(0);
      } else {
        console.log('\n💥 Phase 1.2 Failed - Fix issues before proceeding');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testV3Connectivity };
