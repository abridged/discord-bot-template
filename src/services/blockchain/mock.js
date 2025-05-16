/**
 * Mock Blockchain Service
 * 
 * This service simulates blockchain interactions for development purposes
 * until the real Account Kit integration is available.
 */

const crypto = require('crypto');

/**
 * Blockchain Service Interface
 * This defines the contract that any blockchain implementation must adhere to.
 */
class IBlockchainService {
  async submitQuiz(quizData) { throw new Error('Method not implemented'); }
  async submitAnswer(answerData) { throw new Error('Method not implemented'); }
  async getTransactionStatus(txHash) { throw new Error('Method not implemented'); }
  async getRewards(quizId) { throw new Error('Method not implemented'); }
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
   * Generate a fake transaction hash
   * @returns {string} - Fake transaction hash
   */
  _generateTxHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
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
   * @returns {Promise<string>} - Transaction hash
   */
  async submitQuiz(quizData) {
    console.log('Submitting quiz to mock blockchain:', quizData.id);
    
    // Generate a transaction hash
    const txHash = this._generateTxHash();
    
    // Store transaction hash in database if models are provided
    if (this.models && this.models.Quiz) {
      const quiz = await this.models.Quiz.findByPk(quizData.id);
      if (quiz) {
        await quiz.update({ quizHash: txHash });
      }
    }
    
    // Start transaction simulation
    this._simulateTransaction(txHash);
    
    return txHash;
  }

  /**
   * Submit an answer to the mock blockchain
   * @param {Object} answerData - Answer data to submit
   * @returns {Promise<string>} - Transaction hash
   */
  async submitAnswer(answerData) {
    console.log('Submitting answer to mock blockchain:', answerData.id);
    
    // Generate a transaction hash
    const txHash = this._generateTxHash();
    
    // Store transaction hash in database if models are provided
    if (this.models && this.models.Answer) {
      const answer = await this.models.Answer.findByPk(answerData.id);
      if (answer) {
        await answer.update({ transactionHash: txHash });
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
