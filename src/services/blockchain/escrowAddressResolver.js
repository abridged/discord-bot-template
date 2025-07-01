const { EventParser } = require('../../utils/eventParser');
const { ethers } = require('ethers');

/**
 * Escrow Address Resolver Service
 * Handles deferred resolution of escrow addresses from transaction hashes
 * Uses multiple fallback strategies to handle network connectivity issues
 */
class EscrowAddressResolver {
  constructor(options = {}) {
    this.eventParser = new EventParser();
    this.rpcUrl = options.rpcUrl || process.env.BASE_SEPOLIA_RPC_URL;
    this.motherFactoryAddress = options.motherFactoryAddress || process.env.MOTHER_FACTORY_ADDRESS;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
  }

  /**
   * Resolve escrow address from transaction hash with retry logic
   * @param {string} transactionHash - Transaction hash to analyze
   * @param {string} expectedCreator - Expected creator address
   * @param {string} expectedContractType - Expected contract type (default: 'QuizEscrow')
   * @returns {Promise<Object|null>} Resolved event data or null
   */
  async resolveEscrowAddress(transactionHash, expectedCreator, expectedContractType = 'QuizEscrow') {
    console.log(`🔍 EscrowResolver: Resolving escrow address for transaction: ${transactionHash}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 EscrowResolver: Attempt ${attempt}/${this.maxRetries}`);
        
        // Try different provider configurations
        const providers = this.getProviderConfigurations();
        
        for (const providerConfig of providers) {
          try {
            console.log(`📡 EscrowResolver: Trying provider: ${providerConfig.name}`);
            
            const provider = providerConfig.provider;
            const eventData = await this.eventParser.queryContractDeployedEvent(
              provider,
              this.motherFactoryAddress,
              transactionHash,
              expectedContractType,
              expectedCreator
            );
            
            if (eventData && eventData.contractAddress) {
              console.log(`✅ EscrowResolver: Successfully resolved escrow address: ${eventData.contractAddress}`);
              return {
                success: true,
                escrowAddress: eventData.contractAddress,
                eventData,
                resolvedAt: new Date().toISOString(),
                provider: providerConfig.name,
                attempt
              };
            }
            
          } catch (providerError) {
            console.log(`⚠️  EscrowResolver: Provider ${providerConfig.name} failed:`, providerError.message);
            continue;
          }
        }
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ EscrowResolver: Waiting ${this.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
        
      } catch (attemptError) {
        console.log(`❌ EscrowResolver: Attempt ${attempt} failed:`, attemptError.message);
      }
    }
    
    console.log(`❌ EscrowResolver: Failed to resolve escrow address after ${this.maxRetries} attempts`);
    return {
      success: false,
      error: 'Failed to resolve escrow address after all retry attempts',
      attempts: this.maxRetries
    };
  }

  /**
   * Get multiple provider configurations for fallback
   * @returns {Array} Array of provider configurations
   */
  getProviderConfigurations() {
    const configs = [];
    
    // Primary RPC URL
    if (this.rpcUrl) {
      configs.push({
        name: 'Primary RPC',
        provider: new ethers.providers.JsonRpcProvider(this.rpcUrl)
      });
    }
    
    // Alternative Base Sepolia RPCs
    const alternativeRpcs = [
      'https://sepolia.base.org',
      'https://base-sepolia.blockpi.network/v1/rpc/public',
      'https://base-sepolia-rpc.publicnode.com'
    ];
    
    alternativeRpcs.forEach((rpcUrl, index) => {
      configs.push({
        name: `Alternative RPC ${index + 1}`,
        provider: new ethers.providers.JsonRpcProvider(rpcUrl)
      });
    });
    
    // Alchemy/Infura providers (if API keys available)
    if (process.env.ALCHEMY_API_KEY) {
      configs.push({
        name: 'Alchemy Base Sepolia',
        provider: new ethers.providers.AlchemyProvider('base-sepolia', process.env.ALCHEMY_API_KEY)
      });
    }
    
    if (process.env.INFURA_API_KEY) {
      configs.push({
        name: 'Infura Base Sepolia',
        provider: new ethers.providers.InfuraProvider('base-sepolia', process.env.INFURA_API_KEY)
      });
    }
    
    return configs;
  }

  /**
   * Resolve multiple transaction hashes in batch
   * @param {Array} transactions - Array of {hash, creator, contractType} objects
   * @returns {Promise<Array>} Array of resolution results
   */
  async resolveMultipleEscrowAddresses(transactions) {
    console.log(`🔍 EscrowResolver: Batch resolving ${transactions.length} transactions`);
    
    const results = [];
    for (const tx of transactions) {
      const result = await this.resolveEscrowAddress(tx.hash, tx.creator, tx.contractType);
      results.push({
        transactionHash: tx.hash,
        ...result
      });
    }
    
    return results;
  }

  /**
   * Background job method for async escrow address resolution
   * @param {string} transactionHash - Transaction hash to resolve
   * @param {string} expectedCreator - Expected creator address
   * @param {Function} onSuccess - Callback for successful resolution
   * @param {Function} onFailure - Callback for failed resolution
   */
  async resolveAsync(transactionHash, expectedCreator, onSuccess, onFailure) {
    console.log(`🚀 EscrowResolver: Starting async resolution for ${transactionHash}`);
    
    try {
      const result = await this.resolveEscrowAddress(transactionHash, expectedCreator);
      
      if (result.success) {
        if (onSuccess) await onSuccess(result);
      } else {
        if (onFailure) await onFailure(result);
      }
      
    } catch (error) {
      console.error('❌ EscrowResolver: Async resolution error:', error);
      if (onFailure) await onFailure({ success: false, error: error.message });
    }
  }
}

module.exports = { EscrowAddressResolver };
