/**
 * Quiz Service - Main Export
 * Provides the main interface for quiz creation and management
 */

const { createQuizFromUrl } = require('./orchestrator');

module.exports = {
  createQuizFromUrl
};
