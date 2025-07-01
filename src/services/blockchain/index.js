/**
 * Blockchain Service Index
 * 
 * This file exports the appropriate blockchain service implementation
 * based on the environment configuration.
 */

const RealBlockchainService = require('./realBlockchainService');
const { MockBlockchainService, IBlockchainService, TransactionStatus } = require('./mock');

/**
 * Factory function to create a blockchain service
 * @param {Object} options - Options including models
 * @returns {IBlockchainService} - Blockchain service instance
 */
function createBlockchainService(options = {}) {
  // Check USE_REAL_BLOCKCHAIN first - if explicitly set to true, always use real blockchain
  const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
  
  // Fallback to existing logic if USE_REAL_BLOCKCHAIN is not explicitly set
  const useMock = !useRealBlockchain && (
    process.env.USE_MOCK_BLOCKCHAIN === 'true' || 
    process.env.NODE_ENV === 'test' ||
    !process.env.BLOCKCHAIN_ENABLED
  );
  
  if (useMock) {
    console.log('⚠️  WARNING: Using MOCK blockchain service - on-chain transactions disabled');
    console.log('   All transaction hashes, escrow addresses, and blockchain interactions are simulated');
    return new MockBlockchainService(options);
  } else {
    console.log('✅ Using REAL blockchain service - actual on-chain transactions enabled');
    return new RealBlockchainService(options);
  }
}

/**
 * Get user-facing warning message when mock blockchain is active
 * @returns {string} Warning message for Discord users
 */
function getMockWarningMessage() {
  return '⚠️ **DEMO MODE**: This bot is using simulated blockchain interactions for demonstration purposes. No real tokens will be transferred.';
}

module.exports = {
  IBlockchainService,
  RealBlockchainService,
  MockBlockchainService,
  TransactionStatus,
  createBlockchainService,
  getMockWarningMessage
};
