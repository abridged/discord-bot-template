/**
 * Update Blockchain Configuration
 * 
 * This script updates the blockchain implementation to use real transactions
 * Run with: node scripts/update-blockchain-config.js
 */
const { ethers } = require('ethers');
const { createBlockchainService } = require('../src/services/blockchain');
const { RealBlockchainService } = require('../src/services/blockchain');

// Check if we're currently using mock or real blockchain
async function checkAndUpdateConfig() {
  console.log('============== BLOCKCHAIN CONFIGURATION CHECK ==============');
  
  // Create a blockchain service instance
  const service = createBlockchainService();
  
  // Check if it's using real blockchain
  const isUsingRealBlockchain = service instanceof RealBlockchainService;
  
  console.log(`Using real blockchain transactions: ${isUsingRealBlockchain ? 'YES' : 'NO'}`);
  
  if (!isUsingRealBlockchain) {
    console.log('\nYour quiz is using MOCK blockchain transactions!');
    console.log('This means:');
    console.log('- No real contracts are being deployed');
    console.log('- No actual tokens are being transferred');
    console.log('- The quiz appears to work but has no on-chain component');
    
    console.log('\nTo enable real blockchain transactions:');
    console.log('1. Add this line to your .env file:');
    console.log('USE_REAL_BLOCKCHAIN=true');
    console.log('2. Restart your Discord bot');
    console.log('3. Create a new quiz');
  } else {
    console.log('\nYour quiz is using REAL blockchain transactions!');
    console.log('This means:');
    console.log('- Real contracts are being deployed on-chain');
    console.log('- Actual tokens are being transferred from your wallet');
    
    // Check if the factory contract exists
    const factoryAddress = process.env.QUIZ_FACTORY_ADDRESS;
    if (!factoryAddress) {
      console.log('\n⚠️ WARNING: QUIZ_FACTORY_ADDRESS not set in .env file');
    } else {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
        );
        
        const code = await provider.getCode(factoryAddress);
        
        if (code === '0x') {
          console.log(`\n⚠️ WARNING: No contract found at factory address: ${factoryAddress}`);
        } else {
          console.log(`\n✅ Quiz Factory contract found at: ${factoryAddress}`);
        }
      } catch (error) {
        console.error('Error checking factory contract:', error.message);
      }
    }
  }
  
  console.log('\n============== CONFIGURATION CHECK COMPLETE ==============');
}

// Run the check
checkAndUpdateConfig().catch(console.error);
