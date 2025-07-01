/**
 * Quiz Lock Service
 * 
 * Provides locking mechanisms to prevent duplicate quiz contract deployments
 * and race conditions in the blockchain submission process.
 */

// Simple in-memory lock storage
const quizLocks = new Map();

/**
 * Attempt to acquire a lock for a quiz
 * @param {string} quizId - The ID of the quiz to lock
 * @param {string} operation - The operation being performed (e.g., 'blockchain_submit')
 * @returns {boolean} - Whether the lock was successfully acquired
 */
function acquireLock(quizId, operation) {
  const lockKey = `${quizId}:${operation}`;
  
  // If the lock already exists, return false
  if (quizLocks.has(lockKey)) {
    return false;
  }
  
  // Otherwise, create the lock with timestamp
  quizLocks.set(lockKey, {
    timestamp: Date.now(),
    quizId,
    operation
  });
  
  return true;
}

/**
 * Release a lock for a quiz
 * @param {string} quizId - The ID of the quiz to unlock
 * @param {string} operation - The operation that was performed
 * @returns {boolean} - Whether the lock was successfully released
 */
function releaseLock(quizId, operation) {
  const lockKey = `${quizId}:${operation}`;
  
  // If the lock doesn't exist, return false
  if (!quizLocks.has(lockKey)) {
    return false;
  }
  
  // Otherwise, delete the lock
  quizLocks.delete(lockKey);
  
  return true;
}

/**
 * Check if a quiz is locked for a specific operation
 * @param {string} quizId - The ID of the quiz to check
 * @param {string} operation - The operation to check for
 * @returns {boolean} - Whether the quiz is locked for the specified operation
 */
function isLocked(quizId, operation) {
  const lockKey = `${quizId}:${operation}`;
  
  // Check if the lock exists
  if (!quizLocks.has(lockKey)) {
    return false;
  }
  
  // Get the lock
  const lock = quizLocks.get(lockKey);
  
  // Check if the lock has expired (> 5 minutes)
  const now = Date.now();
  const fiveMinutesInMs = 5 * 60 * 1000;
  
  if (now - lock.timestamp > fiveMinutesInMs) {
    // Lock has expired, delete it
    quizLocks.delete(lockKey);
    return false;
  }
  
  // Lock exists and hasn't expired
  return true;
}

/**
 * Clear all locks
 * Mainly for testing purposes
 */
function clearAllLocks() {
  quizLocks.clear();
}

/**
 * Get all active locks
 * @returns {Array} - Array of all active locks
 */
function getAllLocks() {
  return Array.from(quizLocks.entries()).map(([key, value]) => ({
    key,
    ...value
  }));
}

module.exports = {
  acquireLock,
  releaseLock,
  isLocked,
  clearAllLocks,
  getAllLocks
};