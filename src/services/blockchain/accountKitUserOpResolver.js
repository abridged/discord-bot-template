/**
 * Account Kit User Operation Resolver
 * 
 * Fixes the Account Kit API call to properly extract user operation receipts
 * with the correct parameter format for ERC-4337 transaction resolution.
 * 
 * This service resolves the fundamental difference between EOA transaction hashes
 * and ERC-4337 user operation hashes by using Account Kit's internal API correctly.
 */

const axios = require('axios');
require('dotenv').config();

class AccountKitUserOpResolver {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.ACCOUNT_KIT_BASE_URL || 'https://api-qa.collab.land';
    this.apiKey = options.apiKey || process.env.COLLABLAND_ACCOUNTKIT_API_KEY;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 3000;
    
    if (!this.apiKey) {
      throw new Error('Account Kit API key is required');
    }
  }

  /**
   * Get user operation receipt using corrected API parameters
   * @param {string} userOpHash - ERC-4337 user operation hash
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} User operation receipt with transaction data
   */
  async getUserOperationReceipt(userOpHash, options = {}) {
    console.log(`🔍 AccountKit UserOp Resolver: Getting receipt for ${userOpHash}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.maxRetries}`);
        
        // Corrected API call with proper query parameter
        const endpoint = `/accountkit/v1/telegrambot/evm/userOperationReceipt`;
        const url = `${this.baseUrl}${endpoint}`;
        
        console.log(`📡 API Call: ${url}?userOperationHash=${userOpHash}`);
        
        const response = await axios.get(url, {
          params: {
            userOperationHash: userOpHash,  // ✅ CORRECTED: Use query parameter, not header
            ...(options.chainId && { chainId: options.chainId }),
            ...(options.platform && { platform: options.platform })
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        console.log('✅ User operation receipt retrieved successfully');
        console.log(`📊 Status: ${response.status}`);
        
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
          
          // If it's a 404, the endpoint might not exist
          if (error.response.status === 404) {
            console.log('🔍 404 Error - trying alternative endpoints');
            
            // Try alternative API endpoints
            const alternativeResult = await this.tryAlternativeEndpoints(userOpHash, options);
            if (alternativeResult.success) {
              return alternativeResult;
            }
          }
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
   * Try alternative API endpoints if the main one fails
   * @param {string} userOpHash - User operation hash
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async tryAlternativeEndpoints(userOpHash, options = {}) {
    console.log('🔄 Trying alternative API endpoints...');
    
    const alternativeEndpoints = [
      `/accountkit/v1/evm/userOperationReceipt`,
      `/v2/platform/evm/userOperationReceipt`,
      `/accountkit/v2/evm/userOperationReceipt`
    ];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        console.log(`🧪 Testing endpoint: ${endpoint}`);
        
        const url = `${this.baseUrl}${endpoint}`;
        const response = await axios.get(url, {
          params: {
            userOperationHash: userOpHash,
            ...(options.chainId && { chainId: options.chainId })
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log(`✅ Alternative endpoint success: ${endpoint}`);
        return {
          success: true,
          userOpHash,
          receipt: response.data,
          endpoint,
          resolvedAt: new Date().toISOString()
        };
        
      } catch (altError) {
        console.log(`❌ Alternative endpoint failed: ${altError.response?.status || 'Network'}`);
      }
    }
    
    return { success: false, error: 'All alternative endpoints failed' };
  }

  /**
   * Extract actual transaction data from user operation receipt
   * @param {Object} userOpReceipt - User operation receipt
   * @returns {Object|null} Transaction data
   */
  extractTransactionFromReceipt(userOpReceipt) {
    console.log('🔍 Extracting transaction data from user operation receipt');
    
    // Check common patterns where transaction data might be stored
    const possiblePaths = [
      'receipt',
      'transactionReceipt',
      'actualTransaction',
      'bundlerTransaction',
      'executionReceipt',
      'transaction'
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
          to: txData.to
        };
      }
    }
    
    // Direct access
    if (userOpReceipt.transactionHash || userOpReceipt.hash) {
      return {
        transactionHash: userOpReceipt.transactionHash || userOpReceipt.hash,
        logs: userOpReceipt.logs || [],
        blockNumber: userOpReceipt.blockNumber,
        status: userOpReceipt.status,
        from: userOpReceipt.from,
        to: userOpReceipt.to
      };
    }
    
    console.log('❌ Could not extract transaction data from receipt');
    return null;
  }

  /**
   * Complete user operation resolution: userOp hash → transaction data → events
   * @param {string} userOpHash - User operation hash
   * @param {Object} options - Options
   * @returns {Promise<Object>} Complete resolution result
   */
  async resolveUserOpToTransaction(userOpHash, options = {}) {
    console.log(`🚀 Complete userOp resolution for: ${userOpHash}`);
    
    try {
      // Step 1: Get user operation receipt
      const receiptResult = await this.getUserOperationReceipt(userOpHash, {
        chainId: 84532,  // Base Sepolia
        ...options
      });
      
      if (!receiptResult.success) {
        return receiptResult;
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
      
      console.log(`✅ Successfully resolved userOp to transaction: ${transactionData.transactionHash}`);
      
      return {
        success: true,
        userOpHash,
        actualTransactionHash: transactionData.transactionHash,
        transactionData,
        userOpReceipt: receiptResult.receipt,
        resolvedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Complete userOp resolution failed:', error.message);
      return {
        success: false,
        userOpHash,
        error: `UserOp resolution failed: ${error.message}`
      };
    }
  }
}

module.exports = { AccountKitUserOpResolver };
