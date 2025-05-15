/**
 * LLM Service - Main Export
 * Provides functionality for LLM-based quiz generation
 */

const { 
  generateQuestionsFromContent,
  generateQuiz, 
  standardizeQuestions 
} = require('./quizGenerator');

const promptTemplates = require('./promptTemplates');

module.exports = {
  generateQuestionsFromContent,
  generateQuiz,
  standardizeQuestions,
  promptTemplates
};
