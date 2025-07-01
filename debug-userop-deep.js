/**
 * Deep Investigation of UserOp Transaction Failure
 * Focus on real bot flow context and detailed userOp analysis
 */

const { ethers } = require('ethers');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function debugUserOpDeepDive() {
  console.log('🔍 Deep UserOp Transaction Failure Investigation');
  console.log('===============================================\n');
  
  // 1. Verify Environment
  console.log('1️⃣ Environment Verification:');
  console.log(`   RPC URL: ${process.env.BASE_SEPOLIA_RPC_URL}`);
  console.log(`   Chain ID: ${process.env.DEFAULT_CHAIN_ID || '84532'}`);
  console.log(`   Real Blockchain: ${process.env.USE_REAL_BLOCKCHAIN}`);
  console.log(`   MotherFactory: ${process.env.MOTHER_FACTORY_ADDRESS}`);
  console.log(`   QuizHandler: ${process.env.QUIZ_HANDLER_ADDRESS}`);
  console.log('');
  
  // 2. Test Contract Connectivity
  console.log('2️⃣ Contract Connectivity Test:');
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS;
  const quizHandlerAddress = process.env.QUIZ_HANDLER_ADDRESS;
  
  // Test if contracts exist
  try {
    const motherFactoryCode = await provider.getCode(motherFactoryAddress);
    console.log(`   MotherFactory contract exists: ${motherFactoryCode !== '0x' ? '✅' : '❌'}`);
    
    const quizHandlerCode = await provider.getCode(quizHandlerAddress);
    console.log(`   QuizHandler contract exists: ${quizHandlerCode !== '0x' ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   ❌ Contract existence check failed: ${error.message}`);
  }
  console.log('');
  
  // 3. Simulate Real Deployment Parameters
  console.log('3️⃣ Real Deployment Parameters:');
  
  // Use the same parameters that would be used in real bot deployment
  const deploymentParams = {
    tokenAddress: process.env.DEFAULT_TOKEN_ADDRESS || '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
    prizeAmount: ethers.utils.parseEther('0.001').toString(), // 0.001 ETH
    creatorAddress: process.env.QUIZ_HANDLER_ADDRESS, // Bot wallet as creator
    quizId: 'MyFirstQuizTest1732' // Real quiz ID format
  };
  
  console.log('   Deployment Parameters:');
  console.log(`     Token Address: ${deploymentParams.tokenAddress}`);
  console.log(`     Prize Amount: ${deploymentParams.prizeAmount} wei (${ethers.utils.formatEther(deploymentParams.prizeAmount)} ETH)`);
  console.log(`     Creator Address: ${deploymentParams.creatorAddress}`);
  console.log(`     Quiz ID: ${deploymentParams.quizId}`);
  console.log('');
  
  // 4. Test Contract Function Encoding
  console.log('4️⃣ Contract Function Encoding Test:');
  
  try {
    // Load the actual MotherFactory ABI
    const MotherFactoryABI = require('./contracts/artifacts/contracts/src/MotherFactory.sol/MotherFactory.json');
    const iface = new ethers.utils.Interface(MotherFactoryABI.abi);
    
    // Encode the deployContract function
    const functionData = iface.encodeFunctionData('deployContract', [
      deploymentParams.tokenAddress,
      deploymentParams.prizeAmount,
      deploymentParams.creatorAddress,
      deploymentParams.quizId
    ]);
    
    console.log(`   ✅ Function encoding successful`);
    console.log(`   Function data: ${functionData}`);
    console.log(`   Data length: ${functionData.length} characters`);
    console.log('');
    
    // 5. Gas Estimation Test
    console.log('5️⃣ Gas Estimation Test:');
    
    // Test gas estimation with bot wallet
    const botWallet = '0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee';
    console.log(`   Using bot wallet: ${botWallet}`);
    
    const gasEstimateParams = {
      from: botWallet,
      to: motherFactoryAddress,
      data: functionData,
      value: ethers.utils.parseEther('0.001').toHexString() // 0.001 ETH deployment fee
    };
    
    try {
      const gasEstimate = await provider.estimateGas(gasEstimateParams);
      console.log(`   ✅ Gas estimation successful: ${gasEstimate.toString()} gas`);
      console.log(`   Gas cost: ~${ethers.utils.formatEther(gasEstimate.mul(ethers.utils.parseUnits('20', 'gwei')))} ETH (at 20 gwei)`);
    } catch (gasError) {
      console.log(`   ❌ Gas estimation failed: ${gasError.message}`);
      
      // Check specific error types
      if (gasError.message.includes('insufficient funds')) {
        console.log('     💰 Issue: Bot wallet may lack sufficient ETH');
      } else if (gasError.message.includes('execution reverted')) {
        console.log('     🔧 Issue: Contract call would revert - check function parameters');
      } else if (gasError.message.includes('nonce')) {
        console.log('     🔢 Issue: Nonce-related problem');
      }
    }
    console.log('');
    
    // 6. Bot Wallet Balance Check
    console.log('6️⃣ Bot Wallet Balance Check:');
    
    try {
      const balance = await provider.getBalance(botWallet);
      const balanceEth = ethers.utils.formatEther(balance);
      console.log(`   Bot wallet balance: ${balanceEth} ETH`);
      
      const requiredEth = 0.002; // 0.001 for deployment + 0.001 for gas buffer
      if (parseFloat(balanceEth) < requiredEth) {
        console.log(`   ❌ Insufficient balance! Need at least ${requiredEth} ETH`);
      } else {
        console.log(`   ✅ Balance sufficient for deployment`);
      }
    } catch (balanceError) {
      console.log(`   ❌ Balance check failed: ${balanceError.message}`);
    }
    console.log('');
    
    // 7. MotherFactory Access Control Check
    console.log('7️⃣ MotherFactory Access Control Check:');
    
    try {
      const motherFactory = new ethers.Contract(motherFactoryAddress, MotherFactoryABI.abi, provider);
      
      // Check if bot wallet is authorized
      const isAuthorized = await motherFactory.authorizedBot();
      console.log(`   Authorized bot address: ${isAuthorized}`);
      console.log(`   Bot wallet matches: ${isAuthorized.toLowerCase() === botWallet.toLowerCase() ? '✅' : '❌'}`);
      
      // Check deployment fee
      const deploymentFee = await motherFactory.getDeploymentFee();
      console.log(`   Deployment fee: ${ethers.utils.formatEther(deploymentFee)} ETH`);
      console.log(`   Fee matches payload: ${deploymentFee.toString() === deploymentParams.prizeAmount ? '✅' : '❌'}`);
      
    } catch (contractError) {
      console.log(`   ❌ Contract interaction failed: ${contractError.message}`);
    }
    console.log('');
    
  } catch (abiError) {
    console.log(`   ❌ ABI loading failed: ${abiError.message}`);
    console.log('   Make sure MotherFactory.json exists in contracts/artifacts/contracts/src/MotherFactory.sol/');
  }
  
  // 8. Account Kit SDK Investigation
  console.log('8️⃣ Account Kit SDK Context Analysis:');
  
  console.log('   Key differences between working vs failing calls:');
  console.log('   • Working: Balance checks, user wallet creation');
  console.log('   • Failing: Contract deployment with value transfer');
  console.log('');
  console.log('   Potential failure points:');
  console.log('   1. Value transfer + contract call simulation');
  console.log('   2. Gas estimation in Account Kit vs our estimation');
  console.log('   3. User wallet state (nonce, balance) in Account Kit');
  console.log('   4. Contract simulation context (block state, etc.)');
  console.log('');
  
  // 9. Next Investigation Steps
  console.log('9️⃣ Recommended Next Steps:');
  console.log('   1. Test with actual Discord user ID from bot logs');
  console.log('   2. Check Account Kit user wallet balance before deployment');
  console.log('   3. Compare successful vs failed userOp payloads');
  console.log('   4. Enable detailed Account Kit SDK logging');
  console.log('   5. Test deployment with minimal quiz ID and parameters');
  console.log('');
  
  console.log('🎯 Investigation Complete');
  console.log('Ready for targeted userOp debugging with real bot flow');
}

// Run the deep investigation
debugUserOpDeepDive().catch(console.error);
