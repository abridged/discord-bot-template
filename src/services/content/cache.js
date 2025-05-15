/**
 * Content Caching Service
 * Provides caching functionality for extracted content
 */

// Use in-memory cache for simplicity in this implementation
// In a production system, this could be replaced with Redis or another persistent cache
const cache = new Map();

// Cache TTL in milliseconds (1 hour)
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Cache extracted content from a URL
 * @param {string} url - The URL that was extracted
 * @param {Object} content - The extracted content object
 * @returns {Promise<boolean>} - Success indicator
 */
async function cacheContent(url, content) {
  try {
    if (!url || !content) return false;
    
    const cacheEntry = {
      content,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_TTL
    };
    
    cache.set(url, cacheEntry);
    return true;
  } catch (error) {
    console.error('Error caching content:', error);
    return false;
  }
}

/**
 * Retrieve cached content for a URL
 * @param {string} url - URL to get cached content for
 * @returns {Promise<Object|null>} - Cached content object or null
 */
async function getCachedContent(url) {
  try {
    if (!url) return null;
    
    const cacheEntry = cache.get(url);
    
    // If no cache entry or expired, return null
    if (!cacheEntry || Date.now() > cacheEntry.expiry) {
      if (cacheEntry) cache.delete(url); // Clean up expired entry
      return null;
    }
    
    return cacheEntry.content;
  } catch (error) {
    console.error('Error retrieving cached content:', error);
    return null;
  }
}

/**
 * Clear the entire cache or entries for a specific URL
 * @param {string} [url] - Optional URL to clear from cache
 * @returns {Promise<boolean>} - Success indicator
 */
async function clearCache(url = null) {
  try {
    if (url) {
      cache.delete(url);
    } else {
      cache.clear();
    }
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}

module.exports = {
  cacheContent,
  getCachedContent,
  clearCache
};
