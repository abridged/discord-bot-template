/**
 * Account Kit SDK
 * 
 * Wrapper for the Collab.Land Account Kit API
 */

// Mock implementation for the Account Kit SDK
// In a real implementation, this would import the actual Account Kit SDK

/**
 * Get wallet address for a Discord user
 * @param {string} userId - Discord user ID
 * @returns {Promise<string>} Wallet address or null if not available
 */
async function getUserWallet(userId) {
  try {
    // Special test cases - these take precedence for specific test scenarios
    if (userId === 'no_wallet_user') {
      return null;
    } else if (userId === 'error_user') {
      throw new Error('Account Kit API Error');
    }
    
    // For test environment, allow direct mocking
    if (process.env.NODE_ENV === 'test' && typeof global.mockGetUserWallet === 'function') {
      const result = global.mockGetUserWallet(userId);
      // If the mock returns undefined, fall through to default behavior
      if (result !== undefined) {
        return result;
      }
    }

    // In a real implementation, this would call the Account Kit API
    // return await accountKitClient.getUserWallet(userId);
    
    // Simulate API response
    return '0xUserWalletAddress';
  } catch (error) {
    console.error(`Error fetching wallet for user ${userId}:`, error);
    throw new Error(`Failed to retrieve wallet information: ${error.message}`);
  }
}

/**
 * Send tokens to a user's wallet
 * @param {Object} params - Transfer parameters
 * @returns {Promise<Object>} Transaction result
 */
async function sendTokens(params) {
  const { to, amount, tokenAddress, chainId } = params;
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // In production, this would call the Account Kit API
  return {
    transactionId: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    status: 'success',
    to,
    amount,
    tokenAddress,
    chainId
  };
}

/**
 * Send tokens to multiple users in batch
 * @param {Array} transactions - Array of transaction objects
 * @returns {Promise<Object>} Batch transaction results
 */
async function batchSendTokens(transactions) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Simulate some failed transactions for testing
  const failedTransactions = [];
  const successTransactions = [];
  
  transactions.forEach(tx => {
    // Simulate random failures (about 5% of transactions)
    if (Math.random() < 0.05) {
      failedTransactions.push({
        ...tx,
        error: 'Transaction failed'
      });
    } else {
      successTransactions.push({
        transactionId: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        status: 'success',
        ...tx
      });
    }
  });
  
  return {
    transactions: successTransactions,
    failedTransactions
  };
}

/**
 * Get transaction status
 * @param {string} txId - Transaction ID
 * @returns {Promise<Object>} Transaction details
 */
async function getTransaction(txId) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // For testing, return different statuses based on the txId
  if (txId.includes('pending')) {
    return {
      id: txId,
      status: 'pending',
      from: '0xServiceWallet',
      to: '0xUserWallet',
      value: '1000',
      tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
      chainId: 8453
    };
  }
  
  if (txId.includes('failed')) {
    return {
      id: txId,
      status: 'failed',
      from: '0xServiceWallet',
      to: '0xUserWallet',
      value: '1000',
      tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
      chainId: 8453,
      error: 'Out of gas'
    };
  }
  
  // Default to success
  return {
    id: txId,
    status: 'confirmed',
    from: '0xServiceWallet',
    to: '0xUserWallet',
    value: '1000',
    tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
    chainId: 8453
  };
}

module.exports = {
  getUserWallet,
  sendTokens,
  batchSendTokens,
  getTransaction
};
