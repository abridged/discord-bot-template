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
const { createBlockchainService } = require('../blockchain/mock');
const models = require('../../database/models');

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
    
    console.log('Storage service initialized successfully');
    initialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize storage service:', error);
    return false;
  }
}

/**
 * Save a quiz with its questions
 * @param {Object} quizData - Quiz data
 * @returns {Promise<string>} - Quiz ID
 */
async function saveQuiz(quizData) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // Save quiz to database
    const quizId = await quizRepository.saveQuiz(quizData);
    
    // Submit to blockchain (mock for now)
    const txHash = await blockchainService.submitQuiz({
      ...quizData,
      id: quizId
    });
    
    console.log(`Quiz saved with ID ${quizId} and transaction hash ${txHash}`);
    return quizId;
  } catch (error) {
    console.error('Error saving quiz:', error);
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
 * Save an answer to a quiz question
 * @param {Object} answerData - Answer data
 * @returns {Promise<string>} - Answer ID
 */
async function saveAnswer(answerData) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // Save answer to database
    const answerId = await quizRepository.saveAnswer(answerData);
    
    // Submit to blockchain (mock for now)
    const txHash = await blockchainService.submitAnswer({
      ...answerData,
      id: answerId
    });
    
    console.log(`Answer saved with ID ${answerId} and transaction hash ${txHash}`);
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

module.exports = {
  initialize,
  saveQuiz,
  getQuiz,
  saveAnswer,
  getAnswers,
  getLeaderboard,
  getUserStats,
  getRewards
};
