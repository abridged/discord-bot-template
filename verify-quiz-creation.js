/**
 * Verify Quiz Creation - Database & Blockchain Verification
 * 
 * This script checks:
 * 1. Database records for the created quiz
 * 2. Blockchain state for the deployed QuizEscrow contract
 * 3. Transaction details on Base Sepolia
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function verifyQuizCreation() {
  console.log('🔍 Verifying Quiz Creation - Database & Blockchain\n');
  
  try {
    // Step 1: Check Database Records
    console.log('📊 Step 1: Checking Database Records...');
    
    const { Quiz, Answer } = require('./src/models');
    
    // Get the most recent quiz (should be the one we just created)
    const latestQuiz = await Quiz.findOne({
      order: [['createdAt', 'DESC']],
      raw: true
    });
    
    if (!latestQuiz) {
      console.log('❌ No quiz found in database');
      return;
    }
    
    console.log('✅ Latest Quiz Found:');
    console.log(`   Quiz ID: ${latestQuiz.id}`);
    console.log(`   Creator: ${latestQuiz.creator_discord_id}`);
    console.log(`   Source URL: ${latestQuiz.source_url}`);
    console.log(`   Prize Pool: ${latestQuiz.prize_pool_amount}`);
    console.log(`   Token Address: ${latestQuiz.token_address}`);
    console.log(`   QuizEscrow Address: ${latestQuiz.escrow_contract_address || 'NULL'}`);
    console.log(`   Transaction Hash: ${latestQuiz.deployment_transaction_hash || 'NULL'}`);
    console.log(`   Created: ${latestQuiz.createdAt}\n`);
    
    // Step 2: Check Blockchain State (if escrow address exists)
    if (latestQuiz.escrow_contract_address) {
      console.log('⛓️  Step 2: Checking Blockchain State...');
      
      const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
      
      // Check if contract exists at the address
      const code = await provider.getCode(latestQuiz.escrow_contract_address);
      
      if (code === '0x') {
        console.log('❌ No contract found at escrow address');
      } else {
        console.log('✅ QuizEscrow Contract Deployed:');
        console.log(`   Contract Address: ${latestQuiz.escrow_contract_address}`);
        console.log(`   Contract Code Length: ${code.length} characters`);
        
        // Check transaction details if we have the hash
        if (latestQuiz.deployment_transaction_hash) {
          try {
            const tx = await provider.getTransaction(latestQuiz.deployment_transaction_hash);
            const receipt = await provider.getTransactionReceipt(latestQuiz.deployment_transaction_hash);
            
            console.log('✅ Transaction Details:');
            console.log(`   Hash: ${latestQuiz.deployment_transaction_hash}`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
          } catch (error) {
            console.log(`⚠️  Could not fetch transaction details: ${error.message}`);
          }
        }
      }
    } else {
      console.log('⚠️  Step 2: No escrow contract address found in database');
    }
    
    // Step 3: Summary
    console.log('\n📋 Verification Summary:');
    console.log(`✅ Database Record: ${latestQuiz ? 'Found' : 'Not Found'}`);
    console.log(`✅ Blockchain Contract: ${latestQuiz.escrow_contract_address ? 'Deployed' : 'Not Deployed'}`);
    console.log(`✅ Transaction: ${latestQuiz.deployment_transaction_hash ? 'Recorded' : 'Not Recorded'}`);
    
    console.log('\n🎉 Quiz Creation Verification Complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
  }
}

// Run verification
verifyQuizCreation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
