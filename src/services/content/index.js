/**
 * Content Service - Main Export
 * Provides functionality to extract content from URLs
 */

const { extractContentFromURL } = require('./extractor');
const { cacheContent, getCachedContent, clearCache } = require('./cache');

module.exports = {
  extractContentFromURL,
  cacheContent,
  getCachedContent,
  clearCache
};
