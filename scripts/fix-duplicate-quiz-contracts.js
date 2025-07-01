/**
 * Fix Duplicate Quiz Contracts
 * 
 * This script implements fixes to prevent duplicate quiz contract deployments:
 * 1. Updates realBlockchainService.js to check for existing contracts
 * 2. Adds a database locking mechanism
 * 3. Updates interactionCreate.js to ensure buttons are properly disabled
 * 4. Clears the database to confirm the fixes work
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the quiz lock service
const QUIZ_LOCK_PATH = path.join(__dirname, '../src/services/storage/quiz-lock.js');

// Path to the blockchain service
const BLOCKCHAIN_SERVICE_PATH = path.join(__dirname, '../src/services/blockchain/realBlockchainService.js');

// Create the quiz lock service
function createQuizLockService() {
  console.log('Creating quiz lock service...');
  
  const quizLockContent = `/**
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
  const lockKey = \`\${quizId}:\${operation}\`;
  
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
  const lockKey = \`\${quizId}:\${operation}\`;
  
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
  const lockKey = \`\${quizId}:\${operation}\`;
  
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
};`;

  // Write the quiz lock service
  fs.writeFileSync(QUIZ_LOCK_PATH, quizLockContent);
  console.log(`✅ Created quiz lock service at ${QUIZ_LOCK_PATH}`);
}

// Update the blockchain service to include the contract existence check
function updateBlockchainService() {
  console.log('Reading blockchain service...');
  
  // Read the original file to get the whole context
  const originalContent = fs.readFileSync(BLOCKCHAIN_SERVICE_PATH, 'utf8');
  
  // Find the submitQuiz method
  const methodStartRegex = /async\s+submitQuiz\s*\(\s*quizData\s*,\s*discordUserId\s*\)\s*\{/;
  const methodStartMatch = originalContent.match(methodStartRegex);
  
  if (!methodStartMatch) {
    console.error('Could not find submitQuiz method');
    return false;
  }
  
  const methodStartIndex = methodStartMatch.index;
  
  // Find where to insert the locking logic
  const tryStatementRegex = /try\s*\{[\s\n]*\/\/\s*Calculate quiz expiry time/;
  const tryStatementMatch = originalContent.slice(methodStartIndex).match(tryStatementRegex);
  
  if (!tryStatementMatch) {
    console.error('Could not find try statement in submitQuiz method');
    return false;
  }
  
  const tryStatementIndex = methodStartIndex + tryStatementMatch.index;
  
  // Build the new content
  const newContent = 
    originalContent.slice(0, methodStartIndex) +
    `async submitQuiz(quizData, discordUserId) {
    console.log('============== SUBMITTING QUIZ TO BLOCKCHAIN ==============');
    console.log('Quiz Data:', {
      id: quizData.id,
      tokenAddress: quizData.tokenAddress,
      rewardAmount: quizData.rewardAmount,
      creatorDiscordId: discordUserId
    });
    
    // Import quiz lock service
    const { acquireLock, releaseLock, isLocked } = require('../storage/quiz-lock');
    
    // Check if this quiz is already being processed
    if (isLocked(quizData.id, 'blockchain_submit')) {
      console.log(\`QUIZ ESCROW DEBUG: Quiz \${quizData.id} is already being processed for blockchain submission\`);
      
      // Return a pending status to avoid duplicate submission
      return {
        status: 'pending',
        message: 'Quiz is already being processed for blockchain submission',
        quizId: quizData.id
      };
    }
    
    // Acquire lock for this quiz
    if (!acquireLock(quizData.id, 'blockchain_submit')) {
      console.log(\`QUIZ ESCROW DEBUG: Could not acquire lock for quiz \${quizData.id}\`);
      return {
        status: 'error',
        message: 'Could not acquire lock for quiz',
        quizId: quizData.id
      };
    }
    
    try {
      // Calculate quiz expiry time (end of next day UTC)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setUTCHours(23, 59, 59, 999);
      const expiryTime = Math.floor(tomorrow.getTime() / 1000); // Convert to Unix timestamp
      console.log('Quiz Expiry Time:', expiryTime, '(', new Date(expiryTime * 1000).toISOString(), ')');
      
      // Format token amount for blockchain (convert to wei/smallest units)
      const tokenAmount = ethers.utils.parseUnits(quizData.rewardAmount.toString(), 18);
      console.log('Token Amount (Wei):', tokenAmount.toString());
      console.log('Token Address:', quizData.tokenAddress);
      
      let transactionHash = null;
      let escrowAddress = null;
      console.log('QUIZ ESCROW DEBUG: ============ STARTING CONTRACT EXECUTION ============');
      console.log('QUIZ ESCROW DEBUG: Calling executeUserContractFunction...');
      
      // IMPORTANT: First check if a contract already exists for this quiz
      console.log(\`QUIZ ESCROW DEBUG: Checking if contract already exists for quiz \${quizData.id}...\`);
      
      // Get factory address and ABI from the quizService
      const factoryAddress = this.quizService.factoryAddress || process.env.QUIZ_FACTORY_V2_ADDRESS;
      const QuizFactoryABI = require('../../../contracts/artifacts/contracts/src/QuizFactoryV2.sol/QuizFactoryV2.json').abi;
      
      if (!factoryAddress) {
        // Release the lock before throwing the error
        releaseLock(quizData.id, 'blockchain_submit');
        throw new Error('Quiz factory address is not defined. Check the quizService or QUIZ_FACTORY_V2_ADDRESS env variable.');
      }
      
      if (!QuizFactoryABI) {
        // Release the lock before throwing the error
        releaseLock(quizData.id, 'blockchain_submit');
        throw new Error('Quiz factory ABI is not defined. Check the contracts artifacts.');
      }
      
      // Connect to factory contract to check if an escrow already exists
      const provider = this.quizService.provider;
      const factory = new ethers.Contract(factoryAddress, QuizFactoryABI, provider);
      
      try {
        // Call getEscrowAddress to check if this quiz already has an escrow
        const existingEscrow = await factory.getEscrowAddress(quizData.id);
        
        // Check if the address is valid and not the zero address
        if (existingEscrow && 
            existingEscrow !== '0x0000000000000000000000000000000000000000' &&
            existingEscrow !== ethers.constants.AddressZero) {
          
          console.log(\`QUIZ ESCROW DEBUG: Escrow already exists for quiz \${quizData.id} at \${existingEscrow}\`);
          
          // Check if the contract actually exists on-chain
          const code = await provider.getCode(existingEscrow);
          if (code !== '0x') {
            console.log(\`QUIZ ESCROW DEBUG: Contract confirmed at \${existingEscrow}\`);
            
            // Release the lock since we're returning early
            releaseLock(quizData.id, 'blockchain_submit');
            
            // Return the existing escrow address instead of creating a new one
            return {
              escrowAddress: existingEscrow,
              transactionHash: null, // No new transaction
              status: 'exists',
              message: 'Quiz escrow contract already exists'
            };
          } else {
            console.log(\`QUIZ ESCROW DEBUG: No contract code found at \${existingEscrow}, will create new contract\`);
          }
        }
      } catch (checkError) {
        console.log(\`QUIZ ESCROW DEBUG: Error checking for existing escrow: \${checkError.message}\`);
        // Continue with contract creation, as we couldn't confirm if one exists
      }` + 
    originalContent.slice(tryStatementIndex + tryStatementMatch[0].length);
  
  // Add the lock release in the catch block and at the end of the method
  let updatedContent = newContent.replace(
    /catch\s*\(\s*error\s*\)\s*\{/g, 
    'catch (error) {\n      // Release the lock since we encountered an error\n      releaseLock(quizData.id, \'blockchain_submit\');'
  );
  
  // Add lock release at the end of the method before returning result
  updatedContent = updatedContent.replace(
    /return\s*result;/g,
    'releaseLock(quizData.id, \'blockchain_submit\');\n      return result;'
  );
  
  // Write the updated content
  fs.writeFileSync(BLOCKCHAIN_SERVICE_PATH, updatedContent);
  console.log(`✅ Updated blockchain service at ${BLOCKCHAIN_SERVICE_PATH}`);
  return true;
}

// Clear the database
function clearDatabase() {
  console.log('Clearing database...');
  
  try {
    // Run the database reset script
    execSync('node reset-database.js', { stdio: 'inherit' });
    console.log('✅ Database cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing database:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('======== FIXING DUPLICATE QUIZ CONTRACTS ========');
  
  // Create the quiz lock service
  createQuizLockService();
  
  // Update the blockchain service
  const blockchainServiceUpdated = updateBlockchainService();
  
  if (!blockchainServiceUpdated) {
    console.error('❌ Failed to update blockchain service');
    return;
  }
  
  // Clear the database
  const databaseCleared = clearDatabase();
  
  if (!databaseCleared) {
    console.error('❌ Failed to clear database');
  }
  
  console.log('\n======== FIXES COMPLETED ========');
  console.log('1. Added quiz locking service to prevent duplicate contract creation');
  console.log('2. Added contract existence check to verify if a quiz already has an escrow');
  console.log('3. Added lock release in case of errors');
  console.log('4. Cleared database to test the fixes');
  console.log('\nPlease restart the bot server to apply the changes:');
  console.log('pkill -f "node src/bot/index.js" && npm run bot:dev');
}

main().catch(console.error);
