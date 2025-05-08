/**
 * Rate Limiter Utility
 * 
 * Provides rate limiting functionality to prevent API abuse
 */

class RateLimiter {
  /**
   * Create a new rate limiter
   * @param {Object} options - Configuration options
   * @param {number} options.maxRequests - Maximum requests allowed in the time window
   * @param {number} options.windowMs - Time window in milliseconds
   * @param {string} options.message - Error message when rate limit is exceeded
   */
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // Default: 1 minute
    this.maxRequests = options.maxRequests || 10; // Default: 10 requests per minute
    this.message = options.message || 'Too many requests, please try again later';
    
    // Store client request counts with timestamps
    this.clients = new Map();
    
    // Cleanup interval to remove old entries
    this.interval = setInterval(() => this.cleanup(), this.windowMs);
  }
  
  /**
   * Consume a token from the rate limit bucket
   * @param {string} clientId - Client identifier
   * @returns {Promise<void>} Resolves if allowed, rejects if rate limited
   */
  async consume(clientId) {
    // Get client's request history
    const client = this.clients.get(clientId) || { requests: [], blocked: false };
    
    // If client is currently blocked, reject immediately
    if (client.blocked) {
      return Promise.reject(new Error(this.message));
    }
    
    // Filter requests to only those within the current window
    const now = Date.now();
    const windowStart = now - this.windowMs;
    client.requests = client.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if client exceeds rate limit
    if (client.requests.length >= this.maxRequests) {
      // Block client for the remainder of the window
      client.blocked = true;
      
      // Calculate time until unblocked
      const oldestRequest = Math.min(...client.requests);
      const resetTime = oldestRequest + this.windowMs - now;
      
      // Set timeout to unblock client
      setTimeout(() => {
        const c = this.clients.get(clientId);
        if (c) c.blocked = false;
      }, resetTime);
      
      this.clients.set(clientId, client);
      return Promise.reject(new Error(`${this.message} (Reset in ${Math.ceil(resetTime/1000)} seconds)`));
    }
    
    // Add current request timestamp
    client.requests.push(now);
    this.clients.set(clientId, client);
    
    return Promise.resolve();
  }
  
  /**
   * Clean up old entries from the clients map
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove clients with no recent requests
    for (const [clientId, client] of this.clients.entries()) {
      // Filter to keep only recent requests
      client.requests = client.requests.filter(timestamp => timestamp > windowStart);
      
      // If no recent requests and not blocked, remove client
      if (client.requests.length === 0 && !client.blocked) {
        this.clients.delete(clientId);
      }
    }
  }
  
  /**
   * Reset rate limiter for a client
   * @param {string} clientId - Client identifier
   */
  reset(clientId) {
    if (clientId) {
      this.clients.delete(clientId);
    } else {
      this.clients.clear();
    }
  }
  
  /**
   * Stop the cleanup interval
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = {
  RateLimiter
};
