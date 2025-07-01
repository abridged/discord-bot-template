const { EventParser } = require('../src/utils/eventParser');
const { ethers } = require('ethers');
require('dotenv').config();

async function testEventParsing() {
  console.log('🧪 EVENT PARSING TEST');
  console.log('===================');
  
  try {
    const eventParser = new EventParser();
    const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS;
    
    console.log(`📡 Provider: ${process.env.BASE_SEPOLIA_RPC_URL}`);
    console.log(`🏭 MotherFactory: ${motherFactoryAddress}`);
    
    // Test with the recent transaction hash from our debug runs
    const recentTransactionHash = '0x216d6b3fc576f665824d77e04561e2536304196982d4211e9d3d087e3212ce6c';
    const expectedCreator = '0x4917e853DC273da5F84362aB9f13eE49775B263c';
    
    console.log(`🔍 Testing with transaction: ${recentTransactionHash}`);
    console.log(`👤 Expected creator: ${expectedCreator}`);
    
    // Test event parsing from transaction receipt
    console.log('\n📋 TEST 1: Parse ContractDeployed event from transaction receipt');
    console.log('================================================================');
    
    const eventData = await eventParser.queryContractDeployedEvent(
      provider,
      motherFactoryAddress,
      recentTransactionHash,
      'QuizEscrow',
      expectedCreator
    );
    
    if (eventData) {
      console.log('✅ SUCCESS: ContractDeployed event parsed successfully!');
      console.log('📊 Event Data:', JSON.stringify(eventData, null, 2));
      console.log(`🎯 Escrow Address: ${eventData.contractAddress}`);
      console.log(`🏗️  Contract Type: ${eventData.contractType}`);
      console.log(`👤 Creator: ${eventData.creator}`);
      console.log(`💰 Deployment Fee: ${eventData.deploymentFee} wei`);
    } else {
      console.log('❌ FAILED: Could not parse ContractDeployed event');
    }
    
    // Test alternative: Query recent events by block range
    console.log('\n📋 TEST 2: Query recent ContractDeployed events by block range');
    console.log('==============================================================');
    
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks
      
      console.log(`🔍 Querying blocks ${fromBlock} to ${currentBlock}`);
      
      const events = await eventParser.queryEventsByBlockRange(
        provider,
        motherFactoryAddress,
        fromBlock,
        'latest',
        expectedCreator
      );
      
      console.log(`📊 Found ${events.length} ContractDeployed events for creator ${expectedCreator}`);
      
      events.forEach((event, index) => {
        console.log(`\n📝 Event ${index + 1}:`);
        console.log(`   🎯 Escrow Address: ${event.contractAddress}`);
        console.log(`   🏗️  Contract Type: ${event.contractType}`);
        console.log(`   🧾 Transaction: ${event.transactionHash}`);
        console.log(`   📦 Block: ${event.blockNumber}`);
        console.log(`   💰 Fee: ${event.deploymentFee} wei`);
      });
      
    } catch (blockQueryError) {
      console.log('⚠️  Block range query failed:', blockQueryError.message);
    }
    
    // Test with a known transaction receipt (if available)
    console.log('\n📋 TEST 3: Direct receipt parsing test');
    console.log('====================================');
    
    try {
      const receipt = await provider.getTransactionReceipt(recentTransactionHash);
      if (receipt) {
        console.log(`📄 Receipt found for transaction ${recentTransactionHash}`);
        console.log(`📦 Block: ${receipt.blockNumber}, Status: ${receipt.status}`);
        console.log(`📊 Logs count: ${receipt.logs.length}`);
        
        const parsedEvent = eventParser.parseContractDeployedEvent(
          receipt,
          'QuizEscrow',
          expectedCreator
        );
        
        if (parsedEvent) {
          console.log('✅ SUCCESS: Direct receipt parsing successful!');
          console.log(`🎯 Extracted Escrow Address: ${parsedEvent.contractAddress}`);
        } else {
          console.log('❌ FAILED: Could not parse event from receipt');
        }
        
      } else {
        console.log('❌ Transaction receipt not found');
      }
    } catch (receiptError) {
      console.log('⚠️  Receipt parsing failed:', receiptError.message);
    }
    
  } catch (error) {
    console.error('❌ EVENT PARSING TEST FAILED:', error);
  }
}

// Run the test
testEventParsing()
  .then(() => {
    console.log('\n🎉 Event parsing test completed');
  })
  .catch((error) => {
    console.error('💥 Test script error:', error);
  });
