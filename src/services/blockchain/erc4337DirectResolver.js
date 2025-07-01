/**
 * ERC-4337 Direct Resolver
 * 
 * Resolves ERC-4337 user operation hashes to actual transaction receipts
 * by using the Account Kit SDK's authentication but making corrected API calls
 * to bypass the SDK parameter mismatch issue.
 * 
 * This is a direct solution to resolve the userOp hash → escrow address flow
 * needed for v3 user direct deployment.
 */

const { getAccountKitClient } = require('../../account-kit/sdk');
const { ethers } = require('ethers');
const axios = require('axios');

class ERC4337DirectResolver {
  constructor(options = {}) {
    this.accountKit = null;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 3000;
    this.initialized = false;
  }

  /**
   * Initialize the Account Kit client for authentication
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔧 Initializing ERC-4337 Direct Resolver');
      this.accountKit = getAccountKitClient();
      this.initialized = true;
      console.log('✅ Account Kit client initialized for authentication');
    } catch (error) {
      console.error('❌ Failed to initialize Account Kit client:', error.message);
      throw error;
    }
  }

  /**
   * Get user operation receipt using corrected API call with SDK authentication
   * @param {string} userOpHash - ERC-4337 user operation hash
   * @returns {Promise<Object>} User operation receipt
   */
  async getUserOperationReceipt(userOpHash) {
    await this.initialize();
    
    console.log(`🔍 Direct Resolver: Getting userOp receipt for: ${userOpHash}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.maxRetries}`);
        
        // Extract authentication from Account Kit SDK
        const apiKey = this.accountKit.v1.apiKey;
        const baseUrl = this.accountKit.v1.baseUrl;
        
        console.log(`🔑 Using API key: ${apiKey.substring(0, 10)}...`);
        console.log(`🌐 Using base URL: ${baseUrl}`);
        
        // Make corrected API call with proper query parameter
        const endpoint = '/accountkit/v1/telegrambot/evm/userOperationReceipt';
        const url = `${baseUrl}${endpoint}`;
        
        console.log(`📡 Corrected API call: ${url}?userOperationHash=${userOpHash}`);
        
        const response = await axios.get(url, {
          params: {
            userOperationHash: userOpHash,  // ✅ CORRECTED: Use query parameter
            chainId: 84532  // ✅ REQUIRED: Base Sepolia chain ID
          },
          headers: {
            'X-API-KEY': apiKey,
            'X-TG-BOT-TOKEN': userOpHash,  // ✅ REQUIRED: API also expects this header
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        console.log('✅ User operation receipt retrieved successfully!');
        console.log(`📊 Response Status: ${response.status}`);
        
        const receiptData = response.data;
        console.log('📋 Receipt Data:', JSON.stringify(receiptData, null, 2));
        
        return {
          success: true,
          userOpHash,
          receipt: receiptData,
          resolvedAt: new Date().toISOString(),
          attempt
        };
        
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (error.response) {
          console.log(`📊 Response Status: ${error.response.status}`);
          console.log(`📊 Response Data:`, error.response.data);
        }
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    return {
      success: false,
      userOpHash,
      error: `Failed to get user operation receipt after ${this.maxRetries} attempts`,
      attempts: this.maxRetries
    };
  }

  /**
   * Extract actual transaction data from user operation receipt
   * @param {Object} userOpReceipt - User operation receipt
   * @returns {Object|null} Transaction data with events
   */
  extractTransactionFromReceipt(userOpReceipt) {
    console.log('🔍 Direct Resolver: Extracting transaction data from user operation receipt');
    
    // Common paths where transaction data is stored
    const possiblePaths = [
      'receipt',
      'transactionReceipt', 
      'actualTransaction',
      'bundlerTransaction',
      'executionReceipt',
      'transaction',
      'txReceipt'
    ];
    
    for (const path of possiblePaths) {
      const txData = userOpReceipt[path];
      if (txData && (txData.transactionHash || txData.hash)) {
        console.log(`📋 Found transaction data in: ${path}`);
        return {
          transactionHash: txData.transactionHash || txData.hash,
          logs: txData.logs || [],
          blockNumber: txData.blockNumber,
          status: txData.status,
          from: txData.from,
          to: txData.to,
          gasUsed: txData.gasUsed,
          effectiveGasPrice: txData.effectiveGasPrice
        };
      }
    }
    
    // Direct access
    if (userOpReceipt.transactionHash || userOpReceipt.hash) {
      console.log('📋 Found transaction data at root level');
      return {
        transactionHash: userOpReceipt.transactionHash || userOpReceipt.hash,
        logs: userOpReceipt.logs || [],
        blockNumber: userOpReceipt.blockNumber,
        status: userOpReceipt.status,
        from: userOpReceipt.from,
        to: userOpReceipt.to,
        gasUsed: userOpReceipt.gasUsed,
        effectiveGasPrice: userOpReceipt.effectiveGasPrice
      };
    }
    
    console.log('❌ Could not extract transaction data from receipt');
    console.log('📋 Receipt structure:', JSON.stringify(userOpReceipt, null, 2));
    return null;
  }

  /**
   * Extract QuizEscrow deployment events from transaction logs
   * @param {Array} logs - Transaction logs
   * @param {string} motherFactoryAddress - MotherFactory contract address
   * @returns {Array} ContractDeployed events for QuizEscrow
   */
  extractQuizEscrowEvents(logs, motherFactoryAddress) {
    console.log('🔍 Direct Resolver: Extracting QuizEscrow deployment events');
    console.log(`🏭 MotherFactory address: ${motherFactoryAddress}`);
    console.log(`📋 Total logs: ${logs.length}`);
    
    if (!motherFactoryAddress) {
      console.log('❌ MotherFactory address not provided');
      return [];
    }
    
    try {
      // MotherFactory ContractDeployed event signature
      const contractDeployedTopic = ethers.utils.id('ContractDeployed(address,string,address,uint256)');
      console.log(`🎯 Looking for topic: ${contractDeployedTopic}`);
      
      const quizEscrowEvents = [];
      
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        console.log(`📋 Log ${i + 1}: ${log.address} - Topics: ${log.topics?.length || 0}`);
        
        // Check if this is a ContractDeployed event from MotherFactory
        if (log.address?.toLowerCase() === motherFactoryAddress.toLowerCase() &&
            log.topics?.[0] === contractDeployedTopic) {
          
          console.log('🎉 Found ContractDeployed event!');
          
          try {
            // Decode the event
            const eventInterface = new ethers.utils.Interface([
              'event ContractDeployed(address indexed contractAddress, string contractType, address indexed creator, uint256 deploymentFee)'
            ]);
            
            const decodedEvent = eventInterface.parseLog(log);
            
            console.log('🔍 Decoded Event:');
            console.log(`   Contract Address: ${decodedEvent.args.contractAddress}`);
            console.log(`   Contract Type: ${decodedEvent.args.contractType}`);
            console.log(`   Creator: ${decodedEvent.args.creator}`);
            console.log(`   Deployment Fee: ${decodedEvent.args.deploymentFee.toString()}`);
            
            // Check if this is a QuizEscrow deployment
            if (decodedEvent.args.contractType === 'QuizEscrow') {
              console.log('✅ QuizEscrow deployment event found!');
              
              quizEscrowEvents.push({
                escrowAddress: decodedEvent.args.contractAddress,
                contractType: decodedEvent.args.contractType,
                creator: decodedEvent.args.creator,
                deploymentFee: decodedEvent.args.deploymentFee.toString(),
                logIndex: i,
                transactionLogIndex: log.logIndex
              });
            }
            
          } catch (decodeError) {
            console.error('❌ Failed to decode ContractDeployed event:', decodeError.message);
          }
        }
      }
      
      console.log(`✅ Found ${quizEscrowEvents.length} QuizEscrow deployment events`);
      return quizEscrowEvents;
      
    } catch (error) {
      console.error('❌ Error extracting QuizEscrow events:', error.message);
      return [];
    }
  }

  /**
   * Complete resolution: ERC-4337 userOp hash → escrow address
   * @param {string} userOpHash - User operation hash
   * @param {string} motherFactoryAddress - MotherFactory contract address
   * @param {string} expectedCreator - Expected creator address (optional)
   * @returns {Promise<Object>} Complete resolution result
   */
  async resolveUserOpToEscrowAddress(userOpHash, motherFactoryAddress, expectedCreator = null) {
    console.log('🚀 Direct Resolver: Complete ERC-4337 userOp → escrow address resolution');
    console.log(`🎯 UserOp Hash: ${userOpHash}`);
    console.log(`🏭 MotherFactory: ${motherFactoryAddress}`);
    console.log(`👤 Expected Creator: ${expectedCreator || 'Any'}`);
    
    try {
      // Step 1: Get user operation receipt
      const receiptResult = await this.getUserOperationReceipt(userOpHash);
      
      if (!receiptResult.success) {
        return {
          success: false,
          userOpHash,
          error: 'Failed to get user operation receipt',
          details: receiptResult
        };
      }
      
      // Step 2: Extract transaction data
      const transactionData = this.extractTransactionFromReceipt(receiptResult.receipt);
      
      if (!transactionData) {
        return {
          success: false,
          userOpHash,
          error: 'Could not extract transaction data from user operation receipt',
          receipt: receiptResult.receipt
        };
      }
      
      console.log(`✅ Resolved to transaction: ${transactionData.transactionHash}`);
      
      // Step 3: Extract QuizEscrow deployment events
      const escrowEvents = this.extractQuizEscrowEvents(transactionData.logs, motherFactoryAddress);
      
      if (escrowEvents.length === 0) {
        return {
          success: false,
          userOpHash,
          actualTransactionHash: transactionData.transactionHash,
          error: 'No QuizEscrow deployment events found in transaction',
          transactionData
        };
      }
      
      // Step 4: Validate creator if provided
      let validatedEvent = escrowEvents[0]; // Default to first event
      
      if (expectedCreator) {
        const matchingEvent = escrowEvents.find(event => 
          event.creator.toLowerCase() === expectedCreator.toLowerCase()
        );
        
        if (matchingEvent) {
          validatedEvent = matchingEvent;
          console.log('✅ Found escrow deployment matching expected creator');
        } else {
          console.log('⚠️  No escrow deployment found matching expected creator');
        }
      }
      
      console.log(`🎉 SUCCESSFULLY RESOLVED ESCROW ADDRESS: ${validatedEvent.escrowAddress}`);
      
      return {
        success: true,
        userOpHash,
        actualTransactionHash: transactionData.transactionHash,
        escrowAddress: validatedEvent.escrowAddress,
        escrowEvent: validatedEvent,
        allEscrowEvents: escrowEvents,
        transactionData,
        userOpReceipt: receiptResult.receipt,
        resolvedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Complete userOp → escrow resolution failed:', error.message);
      return {
        success: false,
        userOpHash,
        error: `Complete resolution failed: ${error.message}`,
        stack: error.stack
      };
    }
  }
}

module.exports = { ERC4337DirectResolver };
