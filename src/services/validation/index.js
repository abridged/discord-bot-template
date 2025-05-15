/**
 * Validation Service - Main Export
 * Provides functionality for validating quiz quality
 */

const { 
  validateQuiz,
  validateSingleQuestion,
  calculateRelevanceScore,
  calculateQuestionDifficulty
} = require('./quizValidator');

module.exports = {
  validateQuiz,
  validateSingleQuestion,
  calculateRelevanceScore,
  calculateQuestionDifficulty
};
