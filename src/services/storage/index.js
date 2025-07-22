/**
 * Storage Service
 * 
 * This service provides a unified interface for interacting with both
 * the database and blockchain storage systems. It acts as the bridge
 * between our temporary database solution and the future blockchain
 * implementation.
 */

const { setupDatabase } = require('../../database/setup');
const { createQuizRepository } = require('../../repositories/quiz.repository');
const { createBlockchainService } = require('../blockchain');
const models = require('../../database/models');

// Set environment variable to use real blockchain by default
process.env.USE_REAL_BLOCKCHAIN = process.env.USE_REAL_BLOCKCHAIN || 'false';

// Track initialization state
let initialized = false;
let quizRepository = null;
let blockchainService = null;

/**
 * Initialize the storage service
 * Sets up the database and initializes repositories and services
 * @returns {Promise<boolean>} - Success status
 */
async function initialize() {
  if (initialized) {
    return true;
  }
  
  try {
    // Setup database and run migrations
    const databaseReady = await setupDatabase();
    if (!databaseReady) {
      console.error('Failed to initialize database');
      return false;
    }
    
    // Initialize repository and blockchain service
    quizRepository = createQuizRepository({ models });
    blockchainService = createBlockchainService({ models });
    
    // Mark as initialized (logging happens in bot/index.js)
    initialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize storage service:', error);
    return false;
  }
}

/**
 * Save a quiz to the database
 * @param {Object} quizData - Quiz data to save
 * @param {string} userWallet - User wallet for blockchain operations (optional for dev mode)
 * @returns {Promise<string>} - Quiz ID
 */
async function saveQuiz(quizData, userWallet = null) {
  if (!initialized) {
    await initialize();
  }

  try {
    console.log('Starting quiz creation with validation-first flow...');
    
    // Generate unique quiz ID
    let quizId = quizData.id;
    if (!quizId) {
      quizId = `quiz_${Date.now()}_${quizData.creatorDiscordId}`.substring(0, 36);
      console.log('QUIZ STORAGE DEBUG: Generated new quiz ID:', quizId);
    } else {
      // Check for duplicate ID
      const existingQuiz = await models.Quiz.findByPk(quizId);
      if (existingQuiz) {
        console.log('QUIZ STORAGE DEBUG: Quiz ID already exists, generating new one');
        quizId = `quiz_${Date.now()}_${quizData.creatorDiscordId}`.substring(0, 36);
      }
    }
    
    // Prepare quiz data for blockchain validation
    const blockchainQuizData = {
      ...quizData,
      id: quizId
    };
    
    // Step 1: BLOCKCHAIN VALIDATION FIRST (when USE_REAL_BLOCKCHAIN=true)
    let blockchainResult = null;
    const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
    
    if (useRealBlockchain) {
      console.log(' PRODUCTION MODE: Performing blockchain validation before database save...');
      
      // Validate wallet address is provided
      if (!userWallet) {
        throw new Error('User wallet address is required for blockchain operations');
      }
      
      // Extract wallet address from wallet object or string
      const walletAddress = typeof userWallet === 'string' ? userWallet : 
                           (userWallet?.address || userWallet);
      
      if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        throw new Error('Invalid wallet address format for blockchain operations');
      }
      
      console.log(' Submitting quiz to blockchain for validation...');
      try {
        // Get blockchain service
        const { createBlockchainService } = require('../blockchain');
        const blockchainService = createBlockchainService();
        
        // Submit to blockchain first - this validates MotherFactory/QuizEscrow availability
        blockchainResult = await blockchainService.submitQuiz(
          blockchainQuizData, 
          walletAddress, 
          quizData.creatorDiscordId
        );
        
        console.log(' Blockchain validation successful:', {
          transactionHash: blockchainResult.transactionHash,
          escrowAddress: blockchainResult.escrowAddress,
          expiryTime: blockchainResult.expiryTime
        });
        
        // Update quiz data with blockchain results
        blockchainQuizData.escrowAddress = blockchainResult.escrowAddress;
        blockchainQuizData.transactionHash = blockchainResult.transactionHash;
        blockchainQuizData.expiryTime = blockchainResult.expiryTime;
        blockchainQuizData.onChain = true;
        blockchainQuizData.creatorWalletAddress = walletAddress;
        
      } catch (blockchainError) {
        console.error(' BLOCKCHAIN VALIDATION FAILED:', blockchainError.message);
        console.error(' Blocking quiz creation due to blockchain validation failure');
        throw new Error(`Quiz creation blocked: ${blockchainError.message}`);
      }
    } else {
      console.log(' DEVELOPMENT MODE: Skipping blockchain validation, proceeding to database save...');
      // In development mode, set default values
      blockchainQuizData.onChain = false;
      blockchainQuizData.creatorWalletAddress = userWallet || null;
    }
    
    // Step 2: SAVE TO DATABASE (only after blockchain validation passes)
    console.log(' Saving validated quiz to database...');
    const savedQuizId = await quizRepository.saveQuiz(blockchainQuizData);
    console.log(' Quiz successfully saved to database with ID:', savedQuizId);
    
    return savedQuizId;
    
  } catch (error) {
    console.error(' Quiz creation failed:', error.message);
    // No cleanup needed since we validate blockchain first
    throw error;
  }
}

/**
 * Get a quiz by ID
 * @param {string} quizId - Quiz ID
 * @returns {Promise<Object>} - Quiz data with questions
 */
async function getQuiz(quizId) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    return await quizRepository.getQuiz(quizId);
  } catch (error) {
    console.error('Error getting quiz:', error);
    throw error;
  }
}

/**
 * Get multiple quizzes based on filter criteria
 * @param {Object} filters - Filter criteria (e.g., creatorDiscordId)
 * @returns {Promise<Array>} - Array of quiz objects
 */
async function getQuizzes(filters = {}) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // If the repository doesn't have a getQuizzes method, create a fallback implementation
    if (typeof quizRepository.getQuizzes !== 'function') {
      console.warn('quizRepository.getQuizzes is not implemented, using fallback');
      // Try to use findAll if available (standard Sequelize method)
      if (models && models.Quiz) {
        const quizzes = await models.Quiz.findAll({
          where: filters,
          include: [{ model: models.Question, as: 'questions' }],
          order: [['createdAt', 'DESC']]
        });
        return quizzes.map(quiz => quiz.toJSON ? quiz.toJSON() : quiz);
      }
      return [];
    }
    
    // Use the repository's implementation if available
    return await quizRepository.getQuizzes(filters);
  } catch (error) {
    console.error('Error getting quizzes:', error);
    throw error;
  }
}

/**
 * Save an answer to a quiz question
 * @param {Object} answerData - Answer data
 * @returns {Promise<string>} - Answer ID
 */
async function saveAnswer(answerData) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // First, get the quiz to check for blockchain data
    let quiz = null;
    try {
      quiz = await models.Quiz.findByPk(answerData.quizId);
      
      if (quiz && quiz.escrowAddress) {
        console.log(`Submitting real answer on blockchain for quiz: ${answerData.quizId}`);
        try {
          // Add blockchain data to the answer data
          answerData.escrowAddress = quiz.escrowAddress;
          
          // Submit answer to blockchain
          const blockchainResult = await blockchainService.submitAnswer({
            ...answerData,
            escrowAddress: quiz.escrowAddress
          }, answerData.userWalletAddress, answerData.userDiscordId);
          
          // If we got a transaction hash back, store it
          if (blockchainResult && blockchainResult.transactionHash) {
            answerData.transactionHash = blockchainResult.transactionHash;
            answerData.onChain = true;
            console.log(`Answer submitted on-chain with hash: ${blockchainResult.transactionHash}`);
          }
        } catch (blockchainError) {
          console.error('Error submitting real answer to blockchain:', blockchainError);
          console.log('Falling back to local recording of answer due to blockchain error');
        }
      } else {
        console.log(`No escrow address found for quiz ${answerData.quizId}, using local answer recording`);
      }
    } catch (quizError) {
      console.error('Error retrieving quiz for answer submission:', quizError);
      // Continue with local answer recording
    }
    
    // Save answer to database
    const answerId = await quizRepository.saveAnswer(answerData);
    
    console.log(`Answer saved with ID ${answerId}`);
    return answerId;
  } catch (error) {
    console.error('Error saving answer:', error);
    throw error;
  }
}

/**
 * Get answers for a quiz
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} - Array of answers
 */
async function getAnswers(filters) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    return await quizRepository.getAnswers(filters);
  } catch (error) {
    console.error('Error getting answers:', error);
    throw error;
  }
}

/**
 * Get leaderboard data
 * @param {Object} options - Leaderboard options
 * @returns {Promise<Array>} - Array of leaderboard entries
 */
async function getLeaderboard(options) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    return await quizRepository.getLeaderboard(options);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
}

/**
 * Get user statistics
 * @param {string} userDiscordId - Discord user ID
 * @returns {Promise<Object>} - User stats
 */
async function getUserStats(userDiscordId) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    return await quizRepository.getUserStats(userDiscordId);
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
}

/**
 * Get reward distribution for a quiz
 * @param {string} quizId - Quiz ID
 * @returns {Promise<Object>} - Reward distribution info
 */
async function getRewards(quizId) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    return await blockchainService.getRewards(quizId);
  } catch (error) {
    console.error('Error getting rewards:', error);
    throw error;
  }
}

/**
 * Update a quiz's funding status and related information
 * This is used for database-driven quiz funding workflow
 * @param {string} quizId - Quiz ID
 * @param {Object} fundingData - Funding data to update
 * @returns {Promise<boolean>} - Success status
 */
async function updateQuizFunding(quizId, fundingData) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // Log the funding update for auditing purposes
    console.log(`Updating funding for quiz ${quizId}:`, fundingData);
    
    // Update funding in database
    const success = await quizRepository.updateQuizFunding(quizId, fundingData);
    
    // Also track in blockchain service (mock for now)
    if (success && fundingData.fundingStatus === 'funded') {
      // TODO: Implement blockchain funding tracking when needed
      console.log('STORAGE: Quiz funding updated - blockchain tracking not yet implemented');
    }
    
    return success;
  } catch (error) {
    console.error('Error updating quiz funding:', error);
    throw error;
  }
}

module.exports = {
  initialize,
  saveQuiz,
  getQuiz,
  getQuizzes,
  saveAnswer,
  getAnswers,
  getLeaderboard,
  getUserStats,
  getRewards,
  updateQuizFunding
};
