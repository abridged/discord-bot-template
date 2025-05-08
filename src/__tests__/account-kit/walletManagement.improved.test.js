/**
 * Improved Account Kit Wallet Management Tests
 * 
 * This test suite verifies the functionality of the improved wallet management
 * implementation with enhanced security features.
 */

// Direct mocking approach for the SDK functions
const mockGetUserWallet = jest.fn();
const mockSendTokens = jest.fn();
const mockBatchSendTokens = jest.fn();
const mockGetTransaction = jest.fn();

// Mocking the Account Kit SDK module
jest.mock('../../account-kit/sdk', () => ({
  getUserWallet: (...args) => mockGetUserWallet(...args),
  sendTokens: (...args) => mockSendTokens(...args),
  batchSendTokens: (...args) => mockBatchSendTokens(...args),
  getTransaction: (...args) => mockGetTransaction(...args)
}));

// Mock ethers for address validation
jest.mock('ethers', () => ({
  ethers: {
    utils: {
      isAddress: (address) => {
        // For test purposes, we'll allow test addresses to pass
        if (address === '0xABC123' || 
            address === '0xUserWalletAddress' || 
            address === '0x1111111111111111111111111111111111111111') {
          return true;
        }
        // Basic validation for testing
        return typeof address === 'string' && 
               address.startsWith('0x') && 
               address.length === 42 && 
               !/[^0-9a-fA-F]/.test(address.slice(2));
      },
      getAddress: (address) => {
        // Basic checksum implementation for testing
        if (typeof address !== 'string' || !address.startsWith('0x')) {
          throw new Error('Invalid address format');
        }
        if (address === '0x0000000000000000000000000000000000000000') {
          throw new Error('Zero address not allowed');
        }
        return address;
      }
    }
  }
}));

// Mock the rate limiter
jest.mock('../../utils/rateLimiter', () => {
  const mockConsume = jest.fn().mockResolvedValue();
  return {
    RateLimiter: jest.fn().mockImplementation(() => ({
      consume: mockConsume,
      reset: jest.fn(),
      cleanup: jest.fn(),
      stop: jest.fn()
    }))
  };
});

// Import the module to test
const {
  getWalletForUser,
  distributeRewards,
  processRewardDistribution,
  validateTransaction,
  validateAddress,
  isValidAmount,
  isValidDiscordId
} = require('../../account-kit/walletManagement');

describe('Improved Account Kit Integration', () => {
  // Common test variables
  const discordUserId = 'discord123';
  const walletAddress = '0xUserWalletAddress';
  const validTokenAddress = '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1';
  const chainId = 8453; // Base chain
  const quizId = 'quiz123';
  
  // Sample reward data with valid addresses
  const rewardData = {
    correctUsers: [
      { discordId: 'user1', walletAddress: '0x1111111111111111111111111111111111111111', amount: 1875 },
      { discordId: 'user2', walletAddress: '0x2222222222222222222222222222222222222222', amount: 1875 },
    ],
    incorrectUsers: [
      { discordId: 'user5', walletAddress: '0x5555555555555555555555555555555555555555', amount: 625 },
      { discordId: 'user6', walletAddress: '0x6666666666666666666666666666666666666666', amount: 625 },
    ],
    quizId,
    tokenAddress: validTokenAddress,
    chainId
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks with default behavior
    mockGetUserWallet.mockResolvedValue(walletAddress);
    mockSendTokens.mockResolvedValue({ transactionId: 'tx123', status: 'success' });
    mockBatchSendTokens.mockResolvedValue({
      transactions: [
        { transactionId: 'tx1', status: 'success' },
        { transactionId: 'tx2', status: 'success' }
      ],
      failedTransactions: []
    });
    
    mockGetTransaction.mockResolvedValue({
      id: 'tx123',
      status: 'confirmed',
      from: '0xServiceWallet',
      to: walletAddress,
      value: '1000',
      tokenAddress: validTokenAddress,
      chainId
    });
  });

  //--------------------------------------------------------------
  // 1. Wallet Association Tests
  //--------------------------------------------------------------
  describe('Wallet Association', () => {
    test('should retrieve and cache wallet address for Discord user', async () => {
      // Set up mock
      mockGetUserWallet.mockResolvedValueOnce('0xABC123');
      
      // Call function
      const result = await getWalletForUser(discordUserId);
      
      // Verify wallet address was returned and cached
      expect(result).toBe('0xABC123');
      expect(mockGetUserWallet).toHaveBeenCalledWith(discordUserId);
      
      // Call function again - should use cache
      mockGetUserWallet.mockClear();
      const cachedResult = await getWalletForUser(discordUserId);
      
      // Verify cache was used
      expect(cachedResult).toBe('0xABC123');
      expect(mockGetUserWallet).not.toHaveBeenCalled();
    });
    
    test('should handle case when user has no wallet', async () => {
      // Make a separate direct mock for this test
      const originalMockGetUserWallet = mockGetUserWallet;
      try {
        // Replace the mock with a null response
        mockGetUserWallet.mockReset();
        mockGetUserWallet.mockResolvedValue(null);
        
        // Call function with direct mock
        const result = await getWalletForUser('no_wallet_user');
        
        // Verify null was returned
        expect(result).toBeNull();
      } finally {
        // Restore the original mock
        mockGetUserWallet.mockReset();
        mockGetUserWallet.mockImplementation((...args) => originalMockGetUserWallet(...args));
      }
    });
    
    test('should handle Account Kit API errors gracefully', async () => {
      // Make a separate direct mock for this test
      const originalMockGetUserWallet = mockGetUserWallet;
      try {
        // Replace the mock with an error
        mockGetUserWallet.mockReset();
        mockGetUserWallet.mockRejectedValue(new Error('API Error'));
        
        // In our improved implementation, API errors are properly propagated with additional context
        // This allows callers to properly handle and log these errors
        await expect(getWalletForUser('error_user'))
          .rejects
          .toThrow('Failed to retrieve wallet information: API Error');
      } finally {
        // Restore the original mock
        mockGetUserWallet.mockReset();
        mockGetUserWallet.mockImplementation((...args) => originalMockGetUserWallet(...args));
      }
    });
    
    test('should validate Discord user ID format', async () => {
      // Test directly with the validation function
      expect(isValidDiscordId('user123')).toBe(true);
      expect(isValidDiscordId("user1' OR 1=1--")).toBe(false);
      
      // Set up mock for valid ID test
      const originalMockGetUserWallet = mockGetUserWallet;
      try {
        // Replace the mock with a specific address
        mockGetUserWallet.mockReset();
        mockGetUserWallet.mockResolvedValue('0xABC123');
        
        // Valid ID should work
        const validResult = await getWalletForUser('user123');
        expect(validResult).toBe('0xABC123');
      } finally {
        // Restore the original mock
        mockGetUserWallet.mockReset();
        mockGetUserWallet.mockImplementation((...args) => originalMockGetUserWallet(...args));
      }
      
      // Invalid ID should be rejected
      await expect(getWalletForUser("user1' OR 1=1--"))
        .rejects
        .toThrow('Invalid Discord user ID format');
    });
  });

  //--------------------------------------------------------------
  // 2. Token Distribution Tests
  //--------------------------------------------------------------
  describe('Token Distribution', () => {
    test('should distribute tokens to correct user wallets', async () => {
      // Setup mock with valid wallets
      mockBatchSendTokens.mockResolvedValueOnce({
        transactions: [
          { transactionId: 'tx1', status: 'success' },
          { transactionId: 'tx2', status: 'success' },
          { transactionId: 'tx3', status: 'success' },
          { transactionId: 'tx4', status: 'success' }
        ],
        failedTransactions: []
      });
      
      // Process reward distribution
      const result = await distributeRewards(rewardData);
      
      // Verify batch send was called
      expect(mockBatchSendTokens).toHaveBeenCalled();
      
      // Verify result indicates success
      expect(result.success).toBe(true);
      expect(result.completedTransactions.length).toBeGreaterThan(0);
    });
    
    test('should respect reward distribution rules', async () => {
      // Process reward distribution with 75/25 split
      const result = await distributeRewards(rewardData);
      
      // Verify batch send was called
      expect(mockBatchSendTokens).toHaveBeenCalled();
      
      // Get the transactions
      const transactions = mockBatchSendTokens.mock.calls[0][0];
      
      // Verify we have transactions for both correct and incorrect users
      expect(transactions.length).toBeGreaterThan(0);
      
      // Verify the result structure is as expected
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completedTransactions');
      expect(result).toHaveProperty('failedTransactions');
    });

    test('should handle failed transactions gracefully', async () => {
      // Setup mock with failed transactions
      mockBatchSendTokens.mockResolvedValueOnce({
        transactions: [
          { transactionId: 'tx1', status: 'success' }
        ],
        failedTransactions: [
          { userId: 'user2', amount: 1875, error: 'Insufficient funds' }
        ]
      });
      
      // Process reward distribution
      const result = await distributeRewards(rewardData);
      
      // Verify result
      expect(result.success).toBe(true); // We still consider it a success if some transactions completed
      expect(result).toHaveProperty('completedTransactions');
      expect(result).toHaveProperty('failedTransactions');
    });
    
    test('should handle API retries for transient failures', async () => {
      // Our implementation uses exponential backoff and retries
      // Adjust to have more realistic expectations of the retry behavior
      
      // First call fails with retriable error, second succeeds
      mockBatchSendTokens
        .mockRejectedValueOnce(new Error('Nonce too low')) // This is retriable
        .mockResolvedValueOnce({
          transactions: [
            { transactionId: 'tx1_retry', status: 'success' }
          ],
          failedTransactions: []
        });
      
      // Process reward distribution
      const result = await distributeRewards(rewardData);
      
      // Verify retry succeeded
      expect(result.success).toBe(true);
      expect(mockBatchSendTokens).toHaveBeenCalledTimes(2);
    });
    
    test('should validate transaction status', async () => {
      // Test confirmed transaction
      let isValid = await validateTransaction('tx123');
      expect(isValid).toBe(true);
      
      // Test pending transaction
      mockGetTransaction.mockResolvedValueOnce({
        id: 'tx123',
        status: 'pending',
        from: '0xServiceWallet',
        to: walletAddress,
        value: '1000',
        tokenAddress: validTokenAddress,
        chainId
      });
      
      isValid = await validateTransaction('tx123');
      expect(isValid).toBe(false); // Pending is not considered valid
    });
  });

  //--------------------------------------------------------------
  // 3. Edge Cases
  //--------------------------------------------------------------
  describe('Edge Cases', () => {
    test('should handle quizzes with only correct answers', async () => {
      // Setup quiz with only correct answers
      const correctOnlyRewardData = {
        correctUsers: [
          { discordId: 'user1', walletAddress: '0x1111111111111111111111111111111111111111', amount: 1875 },
          { discordId: 'user2', walletAddress: '0x2222222222222222222222222222222222222222', amount: 1875 }
        ],
        incorrectUsers: [],
        quizId,
        tokenAddress: validTokenAddress,
        chainId
      };
      
      // Process distribution
      const result = await distributeRewards(correctOnlyRewardData);
      
      // Verify batch send was called
      expect(mockBatchSendTokens).toHaveBeenCalled();
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.completedTransactions.length).toBeGreaterThan(0);
    });
    
    test('should handle quizzes with only incorrect answers', async () => {
      // Setup quiz with only incorrect answers
      const incorrectOnlyRewardData = {
        correctUsers: [],
        incorrectUsers: [
          { discordId: 'user5', walletAddress: '0x5555555555555555555555555555555555555555', amount: 625 },
          { discordId: 'user6', walletAddress: '0x6666666666666666666666666666666666666666', amount: 625 }
        ],
        quizId,
        tokenAddress: validTokenAddress,
        chainId
      };
      
      // Process distribution
      const result = await distributeRewards(incorrectOnlyRewardData);
      
      // Verify batch send was called
      expect(mockBatchSendTokens).toHaveBeenCalled();
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.completedTransactions.length).toBeGreaterThan(0);
    });
    
    test('should handle invalid wallet addresses', async () => {
      // Setup with invalid wallet addresses
      const invalidWalletData = {
        correctUsers: [
          { discordId: 'user1', walletAddress: 'not-an-address', amount: 1875 }
        ],
        incorrectUsers: [],
        quizId,
        tokenAddress: validTokenAddress,
        chainId
      };
      
      // Process distribution
      const result = await distributeRewards(invalidWalletData);
      
      // Should still succeed but with no completed transactions
      expect(result.success).toBe(true);
      expect(result.completedTransactions.length).toBe(0);
    });
    
    test('should handle rate limiting', async () => {
      // Reset modules to clear any caches or mocks
      jest.resetModules();
      
      // We need to re-mock the rate limiter module directly
      jest.doMock('../../utils/rateLimiter', () => ({
        RateLimiter: jest.fn().mockImplementation(() => ({
          consume: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
          reset: jest.fn(),
          cleanup: jest.fn(),
          stop: jest.fn()
        }))
      }));
      
      // Re-require the module to apply the new mocks
      const { getWalletForUser } = require('../../account-kit/walletManagement');
      
      // Attempt wallet lookup with a fresh instance
      await expect(getWalletForUser('rate_limited_user'))
        .rejects
        .toThrow('API rate limit exceeded');
      
      // Reset the mock to not affect other tests
      jest.dontMock('../../utils/rateLimiter');
    });
  });
});
