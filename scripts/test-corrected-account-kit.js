const { AccountKitUserOpResolver } = require('../src/services/blockchain/accountKitUserOpResolver');
const { ethers } = require('ethers');
require('dotenv').config();

async function testCorrectedAccountKit() {
  console.log('🧪 TESTING CORRECTED ACCOUNT KIT USER OPERATION RESOLUTION');
  console.log('========================================================');
  
  try {
    // Initialize the corrected resolver
    const resolver = new AccountKitUserOpResolver({
      maxRetries: 2,
      retryDelay: 2000
    });
    
    // Test user operation hash (from our previous deployment)
    const userOpHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    const expectedCreator = '0x3c7c0ebFCD5786ef48df5ed127cdDEb806db976d';
    
    console.log(`🎯 Testing UserOp Hash: ${userOpHash}`);
    console.log(`👤 Expected Creator: ${expectedCreator}`);
    console.log(`🏭 MotherFactory: ${process.env.MOTHER_FACTORY_ADDRESS}`);
    
    // Test 1: User operation receipt extraction
    console.log('\n📋 TEST 1: Corrected user operation receipt extraction');
    console.log('===================================================');
    
    const receiptResult = await resolver.getUserOperationReceipt(userOpHash, {
      chainId: 84532  // Base Sepolia
    });
    
    console.log('\n📊 Receipt Extraction Result:');
    console.log('============================');
    console.log(JSON.stringify(receiptResult, null, 2));
    
    if (receiptResult.success) {
      console.log('✅ User operation receipt extraction SUCCESS!');
      
      // Test 2: Transaction data extraction from receipt
      console.log('\n📋 TEST 2: Transaction data extraction from receipt');
      console.log('=================================================');
      
      const transactionData = resolver.extractTransactionFromReceipt(receiptResult.receipt);
      
      if (transactionData) {
        console.log('✅ Transaction data extraction SUCCESS!');
        console.log(`🔗 Actual Transaction Hash: ${transactionData.transactionHash}`);
        console.log(`📋 Block Number: ${transactionData.blockNumber}`);
        console.log(`📋 Status: ${transactionData.status}`);
        console.log(`📋 Logs Count: ${transactionData.logs?.length || 0}`);
        
        // Test 3: Event parsing from transaction logs
        if (transactionData.logs && transactionData.logs.length > 0) {
          console.log('\n📋 TEST 3: ContractDeployed event parsing');
          console.log('========================================');
          
          try {
            // MotherFactory ContractDeployed event signature
            const contractDeployedTopic = ethers.utils.id('ContractDeployed(address,string,address,uint256)');
            
            console.log(`🔍 Looking for ContractDeployed events...`);
            console.log(`📋 Event signature: ${contractDeployedTopic}`);
            console.log(`🏭 MotherFactory address: ${process.env.MOTHER_FACTORY_ADDRESS}`);
            
            let foundEvent = false;
            
            for (let i = 0; i < transactionData.logs.length; i++) {
              const log = transactionData.logs[i];
              console.log(`\n📋 Log ${i + 1}:`);
              console.log(`   Address: ${log.address}`);
              console.log(`   Topics: ${log.topics?.length || 0} topics`);
              console.log(`   Topic[0]: ${log.topics?.[0]}`);
              
              // Check if this is our ContractDeployed event
              if (log.address?.toLowerCase() === process.env.MOTHER_FACTORY_ADDRESS?.toLowerCase() &&
                  log.topics?.[0] === contractDeployedTopic) {
                
                console.log('🎉 FOUND ContractDeployed event!');
                foundEvent = true;
                
                // Decode the event
                const eventInterface = new ethers.utils.Interface([
                  'event ContractDeployed(address indexed contractAddress, string contractType, address indexed creator, uint256 deploymentFee)'
                ]);
                
                const decodedEvent = eventInterface.parseLog(log);
                
                console.log('🔍 Decoded Event Data:');
                console.log(`   Contract Address: ${decodedEvent.args.contractAddress}`);
                console.log(`   Contract Type: ${decodedEvent.args.contractType}`);
                console.log(`   Creator: ${decodedEvent.args.creator}`);
                console.log(`   Deployment Fee: ${decodedEvent.args.deploymentFee.toString()}`);
                
                // Verify this matches our expected deployment
                if (decodedEvent.args.contractType === 'QuizEscrow' &&
                    decodedEvent.args.creator.toLowerCase() === expectedCreator.toLowerCase()) {
                  console.log('✅ Event matches expected QuizEscrow deployment!');
                  console.log(`🎯 ESCROW ADDRESS FOUND: ${decodedEvent.args.contractAddress}`);
                } else {
                  console.log('⚠️  Event found but parameters don\'t match expected values');
                }
                
                break;
              }
            }
            
            if (!foundEvent) {
              console.log('❌ ContractDeployed event not found in transaction logs');
              
              // Debug: Show all log addresses and topics
              console.log('\n🔍 Debug: All transaction logs:');
              transactionData.logs.forEach((log, index) => {
                console.log(`Log ${index}: ${log.address} - Topics: ${log.topics?.join(', ')}`);
              });
            }
            
          } catch (eventError) {
            console.error('❌ Event parsing error:', eventError.message);
          }
        } else {
          console.log('⚠️  No logs found in transaction data');
        }
        
      } else {
        console.log('❌ Transaction data extraction FAILED');
      }
      
    } else {
      console.log('❌ User operation receipt extraction FAILED');
      console.log(`❌ Error: ${receiptResult.error}`);
    }
    
    // Test 4: Complete resolution method
    console.log('\n📋 TEST 4: Complete userOp → transaction resolution');
    console.log('================================================');
    
    const completeResult = await resolver.resolveUserOpToTransaction(userOpHash);
    
    console.log('\n📊 Complete Resolution Result:');
    console.log('=============================');
    console.log(JSON.stringify(completeResult, null, 2));
    
    if (completeResult.success) {
      console.log('🎉 COMPLETE RESOLUTION SUCCESS!');
      console.log(`🔗 UserOp Hash: ${completeResult.userOpHash}`);
      console.log(`🔗 Actual Transaction Hash: ${completeResult.actualTransactionHash}`);
    } else {
      console.log('❌ Complete resolution failed');
    }
    
  } catch (error) {
    console.error('💥 TEST SCRIPT ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testCorrectedAccountKit()
  .then(() => {
    console.log('\n🎉 Corrected Account Kit test completed');
  })
  .catch((error) => {
    console.error('💥 Test script error:', error);
  });
