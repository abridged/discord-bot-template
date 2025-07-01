/**
 * Account Kit Event Extractor Service
 * 
 * Resolves ERC-4337 user operation hashes to actual transaction receipts
 * and extracts contract deployment event data using Account Kit's internal provider.
 * 
 * This is the CORRECT approach for smart account deployments - DO NOT use ethers.js
 * for user operation hash resolution as they are fundamentally different from EOA transactions.
 */

const { getAccountKitClient } = require('../../account-kit/sdk');
const { ethers } = require('ethers');

class AccountKitEventExtractor {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 3000; // 3 seconds
    this.motherFactoryAddress = options.motherFactoryAddress || process.env.MOTHER_FACTORY_ADDRESS;
  }

  /**
   * Extract escrow address from ERC-4337 user operation hash using Account Kit
   * @param {string} userOpHash - ERC-4337 user operation hash (NOT a transaction hash)
   * @param {string} expectedCreator - Expected creator address
   * @param {string} expectedContractType - Expected contract type (default: 'QuizEscrow')
   * @returns {Promise<Object|null>} Extracted event data or null
   */
  async extractEscrowFromUserOp(userOpHash, expectedCreator, expectedContractType = 'QuizEscrow') {
    console.log(`🔍 AccountKit Extractor: Resolving userOp hash: ${userOpHash}`);
    console.log(`👤 Expected creator: ${expectedCreator}`);
    console.log(`🏗️  Expected contract type: ${expectedContractType}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 AccountKit Extractor: Attempt ${attempt}/${this.maxRetries}`);
        
        // Get Account Kit client
        const client = getAccountKitClient();
        
        // Use Account Kit's ERC-4337 user operation receipt method
        console.log('📡 AccountKit Extractor: Getting user operation receipt...');
        
        let userOpReceipt;
        if (client.v1 && typeof client.v1.telegramBotGetEvmUserOperationReceipt === 'function') {
          console.log('🚀 Using v1.telegramBotGetEvmUserOperationReceipt');
          userOpReceipt = await client.v1.telegramBotGetEvmUserOperationReceipt(userOpHash);
        } else if (client.v2 && typeof client.v2.getUserOperationReceipt === 'function') {
          console.log('🚀 Using v2.getUserOperationReceipt');
          userOpReceipt = await client.v2.getUserOperationReceipt(userOpHash);
        } else {
          throw new Error('Account Kit client does not have user operation receipt method');
        }
        
        console.log('✅ AccountKit Extractor: User operation receipt obtained');
        console.log('📊 UserOp Receipt:', JSON.stringify(userOpReceipt, null, 2));
        
        // Extract the actual transaction hash and receipt from userOp receipt
        const actualTxData = this.extractTransactionFromUserOpReceipt(userOpReceipt);
        
        if (!actualTxData) {
          console.log('⚠️  AccountKit Extractor: No transaction data in userOp receipt');
          continue;
        }
        
        console.log(`🎯 AccountKit Extractor: Actual transaction hash: ${actualTxData.transactionHash}`);
        
        // Parse ContractDeployed event from the actual transaction logs
        const eventData = this.parseContractDeployedEvent(
          actualTxData.logs,
          expectedContractType,
          expectedCreator,
          actualTxData.transactionHash
        );
        
        if (eventData) {
          console.log(`✅ AccountKit Extractor: Successfully extracted escrow address: ${eventData.contractAddress}`);
          return {
            success: true,
            userOpHash,
            actualTransactionHash: actualTxData.transactionHash,
            escrowAddress: eventData.contractAddress,
            eventData,
            resolvedAt: new Date().toISOString(),
            attempt
          };
        } else {
          console.log('⚠️  AccountKit Extractor: ContractDeployed event not found in transaction logs');
        }
        
      } catch (error) {
        console.log(`❌ AccountKit Extractor: Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ AccountKit Extractor: Waiting ${this.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    console.log(`❌ AccountKit Extractor: Failed to extract escrow address after ${this.maxRetries} attempts`);
    return {
      success: false,
      userOpHash,
      error: 'Failed to extract escrow address from user operation after all retry attempts',
      attempts: this.maxRetries
    };
  }

  /**
   * Extract actual transaction data from Account Kit user operation receipt
   * @param {Object} userOpReceipt - User operation receipt from Account Kit
   * @returns {Object|null} Transaction data with hash and logs
   */
  extractTransactionFromUserOpReceipt(userOpReceipt) {
    console.log('🔍 AccountKit Extractor: Extracting transaction from userOp receipt');
    
    // Common fields where actual transaction data might be stored
    const possibleFields = [
      'receipt',
      'transactionReceipt', 
      'actualTransaction',
      'bundlerTransaction',
      'executionReceipt'
    ];
    
    for (const field of possibleFields) {
      if (userOpReceipt[field]) {
        console.log(`📋 Found transaction data in field: ${field}`);
        const txData = userOpReceipt[field];
        
        if (txData.transactionHash || txData.hash) {
          return {
            transactionHash: txData.transactionHash || txData.hash,
            logs: txData.logs || [],
            blockNumber: txData.blockNumber,
            status: txData.status
          };
        }
      }
    }
    
    // Direct access patterns
    if (userOpReceipt.transactionHash || userOpReceipt.hash) {
      return {
        transactionHash: userOpReceipt.transactionHash || userOpReceipt.hash,
        logs: userOpReceipt.logs || [],
        blockNumber: userOpReceipt.blockNumber,
        status: userOpReceipt.status
      };
    }
    
    console.log('❌ AccountKit Extractor: Could not find transaction data in userOp receipt');
    return null;
  }

  /**
   * Parse ContractDeployed event from transaction logs
   * @param {Array} logs - Transaction logs
   * @param {string} expectedContractType - Expected contract type
   * @param {string} expectedCreator - Expected creator address
   * @param {string} transactionHash - Transaction hash for logging
   * @returns {Object|null} Parsed event data or null
   */
  parseContractDeployedEvent(logs, expectedContractType, expectedCreator, transactionHash) {
    console.log(`🔍 AccountKit Extractor: Parsing ContractDeployed event from ${logs.length} logs`);
    
    try {
      // MotherFactory ContractDeployed event signature
      const contractDeployedTopic = ethers.utils.id('ContractDeployed(address,string,address,uint256)');
      
      for (const log of logs) {
        // Check if this log is from MotherFactory and matches ContractDeployed event
        if (log.address?.toLowerCase() === this.motherFactoryAddress?.toLowerCase() &&
            log.topics?.[0] === contractDeployedTopic) {
          
          console.log('📋 Found ContractDeployed event log');
          
          // Decode the event
          const eventInterface = new ethers.utils.Interface([
            'event ContractDeployed(address indexed contractAddress, string contractType, address indexed creator, uint256 deploymentFee)'
          ]);
          
          const decodedEvent = eventInterface.parseLog(log);
          
          console.log('🔍 Decoded event:', {
            contractAddress: decodedEvent.args.contractAddress,
            contractType: decodedEvent.args.contractType,
            creator: decodedEvent.args.creator,
            deploymentFee: decodedEvent.args.deploymentFee.toString()
          });
          
          // Verify this is the event we're looking for
          if (decodedEvent.args.contractType === expectedContractType &&
              decodedEvent.args.creator.toLowerCase() === expectedCreator.toLowerCase()) {
            
            console.log('✅ Event matches expected parameters');
            
            return {
              contractAddress: decodedEvent.args.contractAddress,
              contractType: decodedEvent.args.contractType,
              creator: decodedEvent.args.creator,
              deploymentFee: decodedEvent.args.deploymentFee.toString(),
              transactionHash,
              blockNumber: log.blockNumber
            };
          } else {
            console.log('⚠️  Event found but parameters don\'t match');
            console.log(`   Expected: ${expectedContractType}, ${expectedCreator}`);
            console.log(`   Actual: ${decodedEvent.args.contractType}, ${decodedEvent.args.creator}`);
          }
        }
      }
      
      console.log('❌ ContractDeployed event not found in transaction logs');
      return null;
      
    } catch (error) {
      console.error('❌ Error parsing ContractDeployed event:', error.message);
      return null;
    }
  }

  /**
   * Background async extraction with callbacks
   * @param {string} userOpHash - User operation hash
   * @param {string} expectedCreator - Expected creator address
   * @param {Function} onSuccess - Success callback
   * @param {Function} onFailure - Failure callback
   */
  async extractAsync(userOpHash, expectedCreator, onSuccess, onFailure) {
    console.log(`🚀 AccountKit Extractor: Starting async extraction for ${userOpHash}`);
    
    try {
      const result = await this.extractEscrowFromUserOp(userOpHash, expectedCreator);
      
      if (result.success) {
        if (onSuccess) await onSuccess(result);
      } else {
        if (onFailure) await onFailure(result);
      }
      
    } catch (error) {
      console.error('❌ AccountKit Extractor: Async extraction error:', error);
      if (onFailure) await onFailure({ success: false, error: error.message });
    }
  }
}

module.exports = { AccountKitEventExtractor };
