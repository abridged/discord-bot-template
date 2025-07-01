/**
 * Mock Blockchain Service
 * 
 * This service simulates blockchain interactions for development purposes
 * until the real Account Kit integration is available.
 */

/**
 * Blockchain Service Interface
 * This defines the contract that any blockchain implementation must adhere to.
 */
class IBlockchainService {
  async submitQuiz(quizData, userWallet, discordUserId) { throw new Error('Method not implemented'); }
  async submitAnswer(answerData, userWallet, discordUserId) { throw new Error('Method not implemented'); }
  async getQuizResults(quizId) { throw new Error('Method not implemented'); }
  async getRewards(quizId) { throw new Error('Method not implemented'); }
  async distributeRewards(quizId, winners) { throw new Error('Method not implemented'); }
  async checkUserBalance(userWallet, tokenAddress, requiredAmount, chainId) { throw new Error('Method not implemented'); }
}

/**
 * Transaction status enum
 */
const TransactionStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed'
};

/**
 * Mock implementation of the Blockchain Service
 * This simulates blockchain behavior for development
 */
class MockBlockchainService extends IBlockchainService {
  constructor(options = {}) {
    super();
    this.transactionStore = new Map(); // In-memory store of transaction statuses
    this.simulateDelay = options.simulateDelay || true; // Whether to simulate blockchain delays
    this.models = options.models; // Database models for storing mock tx info
  }

  /**
   * Simulate a delay to mimic blockchain confirmation times
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  _delay(ms = 2000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulate a transaction being processed and confirmed
   * @param {string} txHash - Transaction hash
   * @returns {Promise<void>}
   */
  async _simulateTransaction(txHash) {
    if (!this.simulateDelay) {
      this.transactionStore.set(txHash, TransactionStatus.CONFIRMED);
      return;
    }

    // Simulate pending state
    this.transactionStore.set(txHash, TransactionStatus.PENDING);
    
    // Simulate confirmation delay (2-5 seconds)
    const confirmationTime = Math.random() * 3000 + 2000;
    await this._delay(confirmationTime);
    
    // 95% chance of success, 5% chance of failure to simulate real blockchain
    const success = Math.random() < 0.95;
    this.transactionStore.set(txHash, success ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED);
    
    console.log(`Mock blockchain transaction ${txHash} ${success ? 'confirmed' : 'failed'}`);
  }

  /**
   * Submit a quiz to the mock blockchain
   * @param {Object} quizData - Quiz data to submit
   * @param {string} userWallet - User wallet address
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<Object>} - Transaction info
   */
  async submitQuiz(quizData, userWallet, discordUserId) {
    console.log('🚨 WARNING: MockBlockchainService.submitQuiz CALLED - This should NOT happen when USE_REAL_BLOCKCHAIN=true');
    console.log('🚨 If USE_REAL_BLOCKCHAIN=true, this indicates a configuration error that could mask production issues');
    
    // Check if we're accidentally using mock in production mode
    const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
    if (useRealBlockchain) {
      console.error('🚨 CRITICAL ERROR: MockBlockchainService called when USE_REAL_BLOCKCHAIN=true');
      throw new Error('Mock blockchain service should not be used when USE_REAL_BLOCKCHAIN=true. Check service configuration.');
    }
    
    // Generate a mock transaction hash
    const txHash = '0xMockTx' + Date.now().toString(16);
    console.log('🔧 DEVELOPMENT MODE: Generating mock transaction hash:', txHash);
    
    // Update quiz with mock hash (development only)
    if (this.models && this.models.Quiz) {
      const quiz = await this.models.Quiz.findByPk(quizData.id);
      if (quiz) {
        await quiz.update({ quizHash: txHash });
      }
    }
    
    // Start transaction simulation
    this._simulateTransaction(txHash);
    
    // Generate unique mock escrow address (development only)
    const mockEscrowAddress = '0xMockEscrow' + Date.now().toString(16);
    console.log('🔧 DEVELOPMENT MODE: Generated mock escrow address:', mockEscrowAddress);
    
    return {
      status: TransactionStatus.CONFIRMED,
      transactionHash: txHash,
      escrowAddress: mockEscrowAddress,
      returnValue: mockEscrowAddress
    };
  }

  /**
   * Submit an answer to the mock blockchain
   * @param {Object} answerData - Answer data to submit
   * @param {string} userWallet - User wallet address
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<string>} - Transaction hash
   */
  async submitAnswer(answerData, userWallet, discordUserId) {
    console.log('Submitting answer to mock blockchain:', answerData.id);
    
    // Generate mock transaction hash
    const txHash = `mock_answer_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store transaction hash in database if models are provided
    if (this.models && this.models.Answer) {
      try {
        await this.models.Answer.update(
          { transactionHash: txHash },
          { where: { id: answerData.id } }
        );
      } catch (error) {
        console.warn('MOCK: Could not update answer with mock transaction hash:', error.message);
      }
    }
    
    // Start transaction simulation
    this._simulateTransaction(txHash);
    
    return txHash;
  }

  /**
   * Get the status of a transaction
   * @param {string} txHash - Transaction hash
   * @returns {Promise<string>} - Transaction status
   */
  async getTransactionStatus(txHash) {
    // If transaction isn't in our store, return null
    if (!this.transactionStore.has(txHash)) {
      return null;
    }
    
    return this.transactionStore.get(txHash);
  }

  /**
   * Get reward distribution for a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<Object>} - Reward distribution info
   */
  async getRewards(quizId) {
    // This would normally calculate rewards from blockchain
    // For now, we'll calculate them manually
    
    if (!this.models) {
      return null;
    }
    
    try {
      const quiz = await this.models.Quiz.findByPk(quizId);
      if (!quiz) {
        return null;
      }
      
      // Get all answers for this quiz
      const answers = await this.models.Answer.findAll({
        where: { quizId }
      });
      
      // Calculate rewards
      const totalReward = BigInt(quiz.rewardAmount);
      const correctAnswers = answers.filter(a => a.isCorrect);
      const incorrectAnswers = answers.filter(a => !a.isCorrect);
      
      // 75% to correct answers, 25% to incorrect
      const correctRewardPool = (totalReward * BigInt(75)) / BigInt(100);
      const incorrectRewardPool = totalReward - correctRewardPool;
      
      // Calculate per-answer rewards
      const correctReward = correctAnswers.length > 0 ? 
        correctRewardPool / BigInt(correctAnswers.length) : BigInt(0);
      
      const incorrectReward = incorrectAnswers.length > 0 ? 
        incorrectRewardPool / BigInt(incorrectAnswers.length) : BigInt(0);
      
      // Map user rewards
      const userRewards = {};
      
      // Distribute to correct answers
      for (const answer of correctAnswers) {
        const userId = answer.userDiscordId;
        if (!userRewards[userId]) {
          userRewards[userId] = {
            userDiscordId: userId,
            userWalletAddress: answer.userWalletAddress,
            reward: BigInt(0),
            correctAnswers: 0,
            incorrectAnswers: 0
          };
        }
        
        userRewards[userId].reward += correctReward;
        userRewards[userId].correctAnswers += 1;
      }
      
      // Distribute to incorrect answers
      for (const answer of incorrectAnswers) {
        const userId = answer.userDiscordId;
        if (!userRewards[userId]) {
          userRewards[userId] = {
            userDiscordId: userId,
            userWalletAddress: answer.userWalletAddress,
            reward: BigInt(0),
            correctAnswers: 0,
            incorrectAnswers: 0
          };
        }
        
        userRewards[userId].reward += incorrectReward;
        userRewards[userId].incorrectAnswers += 1;
      }
      
      // Convert to string for JSON compatibility
      const formattedRewards = Object.values(userRewards).map(reward => ({
        ...reward,
        reward: reward.reward.toString()
      }));
      
      return {
        quizId,
        totalReward: totalReward.toString(),
        correctRewardPool: correctRewardPool.toString(),
        incorrectRewardPool: incorrectRewardPool.toString(),
        correctAnswersCount: correctAnswers.length,
        incorrectAnswersCount: incorrectAnswers.length,
        userRewards: formattedRewards
      };
    } catch (error) {
      console.error('Error calculating rewards:', error);
      return null;
    }
  }

  async getQuizResults(quizId) {
    console.log('MOCK: Getting quiz results for:', quizId);
    
    if (!this.models) {
      return {
        quizId,
        status: 'MOCK_COMPLETED',
        totalAnswers: 0,
        correctAnswers: 0,
        results: []
      };
    }

    try {
      const answers = await this.models.Answer.findAll({
        where: { quizId }
      });

      const results = answers.map(answer => ({
        userDiscordId: answer.userDiscordId,
        userWalletAddress: answer.userWalletAddress,
        isCorrect: answer.isCorrect,
        submittedAt: answer.createdAt
      }));

      return {
        quizId,
        status: 'MOCK_COMPLETED',
        totalAnswers: answers.length,
        correctAnswers: answers.filter(a => a.isCorrect).length,
        results
      };
    } catch (error) {
      console.error('MOCK: Error getting quiz results:', error);
      return null;
    }
  }

  async getRewards(userId) {
    console.log('MOCK: Getting rewards for user:', userId);
    
    // Return mock rewards structure
    return {
      userId,
      totalRewards: '0',
      pendingRewards: '0',
      claimedRewards: '0',
      quizRewards: [],
      mockData: true
    };
  }

  async distributeRewards(quizId, winners) {
    console.log('MOCK: Distributing rewards for quiz:', quizId);
    console.log('MOCK: Winners:', winners);

    // Generate mock distribution transaction
    const txHash = `mock_distribution_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      transactionHash: txHash,
      quizId,
      distributedTo: winners.map(winner => ({
        userDiscordId: winner.userDiscordId,
        userWalletAddress: winner.userWalletAddress,
        reward: winner.reward,
        txHash: `mock_reward_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })),
      mockData: true
    };
  }

  async checkUserBalance(userWallet, tokenAddress, requiredAmount, chainId) {
    console.log('MOCK: Performing REAL balance check (development mode):', userWallet);
    
    // Import Account Kit SDK - balance checking is ALWAYS real via Account Kit
    const { ethers } = require('ethers'); // Needed for BigNumber comparisons
    const { getUserWallet } = require('../../account-kit/sdk');
    
    try {
      // Validate inputs before making Account Kit calls
      if (!userWallet || !tokenAddress || !requiredAmount) {
        throw new Error(`Invalid parameters: wallet=${userWallet}, token=${tokenAddress}, amount=${requiredAmount}`);
      }
      
      console.log(`[DEV MODE BALANCE CHECK] Using Account Kit for real balance check`);
      
      // The userWallet parameter is already a wallet address retrieved from Account Kit
      // earlier in the flow (in the handlers), so we don't need to call getUserWallet again
      if (!userWallet || !ethers.utils.isAddress(userWallet)) {
        throw new Error(`Invalid wallet address provided: ${userWallet}`);
      }
      
      console.log(`[DEV MODE BALANCE CHECK] Using provided wallet address: ${userWallet}`);
      
      // For development mode, we'll simulate balance information since Account Kit
      // doesn't provide balance details in the basic wallet lookup
      // This maintains the dev mode functionality while using real Account Kit authentication
      const balance = '0'; // Dev mode: simulate insufficient balance to test flow
      const balanceFormatted = '0';
      const symbol = 'ETH'; // Assume ETH for Base Sepolia
      
      console.log(`[DEV MODE BALANCE CHECK] Simulated balance: ${balanceFormatted} ${symbol}`);
      console.log(`[DEV MODE BALANCE CHECK] Required: ${requiredAmount}`);
      
      // Compare balance with required amount
      const balanceBN = ethers.BigNumber.from(balance);
      const requiredBN = ethers.BigNumber.from(requiredAmount);
      const hasInsufficientBalance = balanceBN.lt(requiredBN);
      
      console.log(`[DEV MODE BALANCE CHECK] Has insufficient balance: ${hasInsufficientBalance}`);
      
      const realResult = {
        balance: balance.toString(),
        balanceFormatted: balanceFormatted,
        requiredAmount: requiredAmount.toString(),
        requiredAmountFormatted: ethers.utils.formatEther(requiredAmount), // Assume ETH for formatting
        tokenAddress,
        tokenSymbol: symbol,
        chainId,
        hasInsufficientBalance,
        mockData: true // This is simulated balance data in dev mode, but uses real Account Kit auth
      };
      
      console.log(`[DEV MODE BALANCE CHECK] Real Account Kit result:`, realResult);
      return realResult;
      
    } catch (error) {
      console.error('[DEV MODE BALANCE CHECK] Error checking user balance via Account Kit:', error);
      
      // Return error state with insufficient balance to block quiz creation
      const errorResult = {
        balance: '0',
        balanceFormatted: '0',
        requiredAmount: requiredAmount.toString(),
        requiredAmountFormatted: 'Unknown',
        tokenAddress: tokenAddress || 'UNKNOWN',
        tokenSymbol: 'Unknown',
        chainId,
        hasInsufficientBalance: true, // Block quiz creation on error
        error: error.message,
        mockData: false
      };
      console.log(`[DEV MODE BALANCE CHECK] Error result:`, errorResult);
      return errorResult;
    }
  }
}

/**
 * Factory function to create a blockchain service
 * @param {Object} options - Options including models
 * @returns {IBlockchainService} - Blockchain service instance
 */
function createBlockchainService(options = {}) {
  // For now, we always return the mock implementation
  // In the future, we'll switch to a real blockchain implementation
  return new MockBlockchainService(options);
}

module.exports = {
  IBlockchainService,
  MockBlockchainService,
  TransactionStatus,
  createBlockchainService
};
