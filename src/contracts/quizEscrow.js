/**
 * Quiz Escrow Contract Interaction - STUB VERSION
 * 
 * This is a temporary stub while the factory and escrow contracts are being rewritten.
 * Maintains API compatibility to prevent runtime errors.
 */

/**
 * Quiz Escrow Factory class - STUB
 * Maintains interface compatibility during contract rewrite
 */
class QuizEscrowFactory {
  constructor() {
    this.deployedContracts = new Map();
  }
  
  getContract(quizId) {
    return this.deployedContracts.get(quizId) || null;
  }
  
  trackContract(quizId, contractAddress) {
    this.deployedContracts.set(quizId, {
      contractAddress,
      createdAt: new Date()
    });
  }
}

/**
 * Create a new quiz escrow contract - STUB
 * @param {Object} params - Contract parameters
 * @param {Object} signer - Ethers.js signer
 * @returns {Promise<Object>} Mock contract data
 */
async function createQuizEscrow(params, signer) {
  // Return mock data to maintain API compatibility
  const { v4: uuidv4 } = require('uuid');
  const quizId = params.quizId || uuidv4();
  
  return {
    address: `0x${Math.random().toString(16).substring(2, 42).padStart(40, '0')}`,
    quizId: quizId,
    tokenAddress: params.tokenAddress, // Use provided token address, no fallback
    rewardAmount: params.amount || 10000,
    correctAnswer: params.correctAnswer || 0,
    expiryTimestamp: params.expiryTimestamp || Math.floor(Date.now() / 1000) + 86400,
    deployed: true,
    isStub: true
  };
}

/**
 * Get a reference to a quiz contract - STUB
 * @param {string} contractAddress - Quiz contract address
 * @param {Object} signer - Ethers.js signer
 * @returns {Promise<Object>} Mock contract instance
 */
async function getQuizContract(contractAddress, signer) {
  return {
    address: contractAddress,
    quizId: `quiz_${Date.now()}`,
    tokenAddress: null, // No hardcoded address - should be provided by caller
    rewardAmount: 10000,
    getSubmissions: () => [],
    submitAnswer: async () => ({ wait: async () => ({}) }),
    distributeRewards: async () => ({ wait: async () => ({}) }),
    connect: (signer) => ({
      submitAnswer: async () => ({ wait: async () => ({}) }),
      distributeRewards: async () => ({ wait: async () => ({}) })
    }),
    isStub: true
  };
}

/**
 * Get quiz expiry time - STUB
 * @param {string} contractAddress - Quiz escrow contract address
 * @param {Object} signer - Ethers.js signer
 * @returns {Promise<number>} Mock expiry timestamp
 */
async function getQuizExpiry(contractAddress, signer) {
  return Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
}

/**
 * Submit an answer to a quiz - STUB
 * @param {string} quizContractAddress - The address of the quiz contract
 * @param {number} answerIndex - The index of the selected answer
 * @param {*} signer - The ethers signer object
 * @returns {Promise<boolean>} True if successful
 */
async function submitAnswer(quizContractAddress, answerIndex, signer) {
  console.log(`[STUB] Submit answer ${answerIndex} to quiz at ${quizContractAddress}`);
  return true;
}

/**
 * Distribute rewards for a completed quiz - STUB
 * @param {string} contractAddress - Contract address
 * @param {Object} signer - Ethers.js signer
 * @param {number} correctAnswerIndex - Correct answer index
 * @returns {Promise<Object>} Mock distribution results
 */
async function distributeRewards(contractAddress, signer, correctAnswerIndex) {
  console.log(`[STUB] Distribute rewards for quiz at ${contractAddress}, correct answer: ${correctAnswerIndex}`);
  
  return {
    correctUsers: [
      { address: '0xCorrectUser1', answerIndex: correctAnswerIndex, claimed: false }
    ],
    incorrectUsers: [
      { address: '0xIncorrectUser1', answerIndex: 0, claimed: false }
    ],
    correctAnswerReward: 7500,
    incorrectAnswerReward: 2500,
    totalReward: 10000,
    isStub: true
  };
}

/**
 * Calculate reward distribution - MAINTAINED
 * @param {number} totalUsers - Total number of users
 * @param {number} correctUsers - Number of correct users
 * @param {number} totalReward - Total reward amount
 * @returns {Object} Reward distribution
 */
function calculateRewards(totalUsers, correctUsers, totalReward) {
  // Keep original logic for compatibility
  const correctPortion = Math.floor(totalReward * 0.75);
  const incorrectPortion = Math.floor(totalReward * 0.25);
  
  const incorrectUsers = totalUsers - correctUsers;
  
  let correctAnswerReward = 0;
  let incorrectAnswerReward = 0;
  
  if (correctUsers > 0) {
    correctAnswerReward = Math.floor(correctPortion / correctUsers);
  }
  
  if (incorrectUsers > 0) {
    incorrectAnswerReward = Math.floor(incorrectPortion / incorrectUsers);
  }
  
  return {
    correctAnswerReward,
    incorrectAnswerReward,
    totalReward
  };
}

module.exports = {
  QuizEscrowFactory,
  createQuizEscrow,
  getQuizContract,
  getQuizExpiry,
  submitAnswer,
  distributeRewards,
  calculateRewards
};
