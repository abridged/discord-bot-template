/**
 * Quiz Utility Functions
 * 
 * This module provides shared utility functions for quiz operations across the application.
 * These functions handle common tasks such as:
 * - Session management and state tracking
 * - Quiz ID and session ID generation
 * - UI elements creation (buttons, embeds)
 * - Database interactions for quiz attempts and completions
 * 
 * The functions are designed to work with both the /ask and /mother commands that create quizzes.
 */

const crypto = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

/**
 * Generates a unique ID for a quiz
 * 
 * Creates a quiz identifier that combines the base ID (usually a URL or hash),
 * the creator's user ID, and a timestamp for uniqueness.
 * 
 * @param {string} baseId - Base identifier (quiz ID or URL)
 * @param {string} userId - Discord user ID of quiz creator
 * @returns {string} Unique quiz identifier
 */
function generateUniqueQuizId(baseId, userId) {
  if (!baseId) {
    console.warn('Warning: Missing baseId in generateUniqueQuizId, using fallback');
    baseId = crypto.randomBytes(4).toString('hex');
  }
  
  if (!userId) {
    console.warn('Warning: Missing userId in generateUniqueQuizId, using fallback');
    userId = 'unknown_user';
  }
  
  const timestamp = Date.now();
  return `${baseId}_${userId}_${timestamp}`;
}

/**
 * Creates a session ID for tracking user quiz state
 * 
 * Combines user ID and quiz ID to create a unique session identifier
 * that's used as a key in the global quiz state cache.
 * 
 * @param {string} userId - Discord user ID
 * @param {string} quizId - Unique quiz identifier
 * @returns {string} Session identifier for cache lookups
 * @throws {Error} If required parameters are missing
 */
function createSessionId(userId, quizId) {
  if (!userId || !quizId) {
    throw new Error('Cannot create session ID: missing userId or quizId');
  }
  return `${userId}_${quizId}`;
}

/**
 * Finds the active quiz session for a user based on question index
 * 
 * Searches the global userQuizState map for a session matching the user ID
 * and the specific question index. Used to determine which session a button
 * interaction belongs to when a user is taking a quiz.
 * 
 * @param {Object} client - Discord client object
 * @param {string} userId - Discord user ID
 * @param {number} questionIndex - Current question index
 * @returns {Object|null} User quiz state or null if not found
 */
function findActiveQuizSession(client, userId, questionIndex) {
  // Early validation
  if (!client || !userId) {
    console.error('Missing required parameters in findActiveQuizSession:', { client: !!client, userId });
    return null;
  }

  // Check if quiz state cache is initialized
  if (!client.userQuizState || !(client.userQuizState instanceof Map)) {
    console.warn('Quiz state cache not initialized in client');
    return null;
  }

  try {
    // Get all session keys and filter to this user's sessions
    const sessionKeys = Array.from(client.userQuizState.keys());
    const userSessions = sessionKeys.filter(key => key.startsWith(`${userId}_`));
    
    console.log(`Found ${userSessions.length} active sessions for user ${userId}`);
    
    // Look for session with matching question index
    for (const sessionId of userSessions) {
      const session = client.userQuizState.get(sessionId);
      if (session && session.currentQuestionIndex === questionIndex) {
        return session;
      }
    }
    
    console.log(`No session found for user ${userId} at question ${questionIndex}`);
    return null;
  } catch (error) {
    console.error('Error finding active quiz session:', error);
    return null;
  }
}

/**
 * Creates question embed for quiz
 * 
 * Formats a Discord embed with a quiz question, showing the question number
 * and prompt text. The embed is displayed to users when taking a quiz.
 * 
 * @param {Object} question - Question data object containing the question text
 * @param {number} questionIndex - Zero-indexed question number 
 * @param {number} totalQuestions - Total number of questions in the quiz
 * @returns {EmbedBuilder} Discord embed for the question
 */
function createQuestionEmbed(question, questionIndex, totalQuestions) {
  if (!question || typeof question !== 'object') {
    console.error('Invalid question object in createQuestionEmbed:', question);
    // Create a fallback embed with error information
    return new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Error: Invalid Question')
      .setDescription('There was an error loading this question.')
      .setFooter({ text: 'Please report this issue' });
  }
  
  // Create standard question embed
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`Question ${questionIndex + 1} of ${totalQuestions}`)
    .setDescription(question.question || 'No question text available')
    .setFooter({ text: 'Select one answer below' });
}

/**
 * Creates answer buttons for a quiz question
 * 
 * Generates a row of Discord buttons for quiz answer options.
 * Each button is labeled with an answer choice and has a custom ID
 * that encodes both the question index and the option index.
 * 
 * @param {Array<string>} options - Answer option texts
 * @param {number} questionIndex - Current question index (zero-based)
 * @returns {ActionRowBuilder} Action row with answer option buttons
 */
function createAnswerButtons(options, questionIndex) {
  // Validate inputs
  if (!Array.isArray(options) || options.length === 0) {
    console.error('Invalid options array in createAnswerButtons:', options);
    // Create a single error button as fallback
    const actionRow = new ActionRowBuilder();
    const errorButton = new ButtonBuilder()
      .setCustomId(`quiz_error:${questionIndex}:0`)
      .setLabel('Error: No options available')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true);
    
    actionRow.addComponents(errorButton);
    return actionRow;
  }
  
  // Create the button row
  const actionRow = new ActionRowBuilder();
  
  // Discord allows at most 5 buttons per row
  const buttonCount = Math.min(options.length, 5);
  
  // Add each option as a button
  for (let i = 0; i < buttonCount; i++) {
    // Handle potentially undefined or null options
    const optionText = options[i] || `Option ${i+1}`;
    
    // Trim to Discord's limit and create button
    const answerButton = new ButtonBuilder()
      .setCustomId(`quiz_answer:${questionIndex}:${i}`)
      .setLabel(optionText.substring(0, 80)) // Discord has an 80-char limit for button labels
      .setStyle(ButtonStyle.Primary);
    
    actionRow.addComponents(answerButton);
  }
  
  return actionRow;
}

/**
 * Checks if a user has already completed a specific quiz
 * 
 * This function checks both the database (if available) and an in-memory cache
 * to determine if a user has already completed a quiz. This prevents users from 
 * taking the same quiz multiple times.
 * 
 * @param {Object} interaction - Discord interaction object containing client reference
 * @param {string} userId - Discord user ID
 * @param {string} quizId - Unique quiz ID
 * @returns {Promise<boolean>} Whether user has completed the quiz
 */
async function hasCompletedQuiz(interaction, userId, quizId) {
  // Validate inputs
  if (!interaction || !userId || !quizId) {
    console.error('Missing required parameters in hasCompletedQuiz:', {
      interaction: !!interaction,
      userId,
      quizId
    });
    // If we can't validate completion status, assume they haven't completed it
    return false;
  }

  try {
    // First check database if it's available
    if (interaction.client.quizDb && interaction.client.quizDb.QuizCompletion) {
      console.log(`Checking database for quiz completion: User ${userId}, Quiz ${quizId}`);
      try {
        // Check the database for completed quizzes
        const completedQuiz = await interaction.client.quizDb.QuizCompletion.findOne({
          where: {
            userId: userId,
            quizId: quizId
          }
        });
        
        if (completedQuiz) {
          console.log(`User ${userId} has previously completed quiz ${quizId} (DB record found)`);
          return true;
        }
      } catch (dbError) {
        console.error('Database error checking quiz completion:', dbError);
        // Continue to memory check on DB error
      }
    }

    // Fallback to in-memory check if database not available or found no record
    const completedInMemory = interaction.client.completedQuizzes?.get(userId)?.includes(quizId) || false;
    
    if (completedInMemory) {
      console.log(`User ${userId} has previously completed quiz ${quizId} (memory cache)`);
    }
    
    return completedInMemory;
  } catch (error) {
    console.error('Unexpected error checking quiz completion:', error);
    // Be conservative - if we can't verify completion, assume they haven't completed it
    return false;
  }
}

/**
 * Checks if a user has already attempted a specific quiz
 * 
 * This function checks if a user has either completed a quiz or has an active
 * attempt in progress. It checks completed quizzes first (which is faster),
 * then the database for past attempts, and finally active sessions in memory.
 * 
 * @param {Object} interaction - Discord interaction object containing client reference
 * @param {string} userId - Discord user ID
 * @param {string} quizId - Unique quiz ID
 * @returns {Promise<boolean>} Whether user has attempted the quiz
 */
async function hasAttemptedQuiz(interaction, userId, quizId) {
  // Validate inputs
  if (!interaction || !userId || !quizId) {
    console.error('Missing required parameters in hasAttemptedQuiz:', {
      interaction: !!interaction,
      userId,
      quizId
    });
    // If we can't validate attempt status, assume they haven't attempted it
    return false;
  }

  try {
    // Step 1: Check if the user has completed the quiz (fastest check)
    const completed = await hasCompletedQuiz(interaction, userId, quizId);
    if (completed) {
      console.log(`User ${userId} has completed quiz ${quizId}, counting as attempted`);
      return true;
    }
    
    // Step 2: Check the database for attempted quizzes if DB is available
    if (interaction.client.quizDb && interaction.client.quizDb.QuizAttempt) {
      try {
        console.log(`Checking database for quiz attempts: User ${userId}, Quiz ${quizId}`);
        const attemptedQuiz = await interaction.client.quizDb.QuizAttempt.findOne({
          where: {
            userId: userId,
            quizId: quizId
          }
        });
        
        if (attemptedQuiz) {
          console.log(`User ${userId} has previously attempted quiz ${quizId} (DB record found)`);
          return true;
        }
      } catch (dbError) {
        console.error('Database error checking quiz attempts:', dbError);
        // Continue to memory check on DB error
      }
    }
    
    // Step 3: Check active sessions in memory
    if (interaction.client.userQuizState) {
      try {
        const sessionId = createSessionId(userId, quizId);
        const hasActiveSession = interaction.client.userQuizState.has(sessionId);
        
        if (hasActiveSession) {
          console.log(`User ${userId} has active session for quiz ${quizId}`);
          return true;
        }
      } catch (sessionError) {
        console.error('Error checking active quiz sessions:', sessionError);
        // Continue to final return
      }
    }
    
    // No record of attempt found anywhere
    return false;
  } catch (error) {
    console.error('Unexpected error checking quiz attempts:', error);
    // Conservative approach - if there's an error, assume it hasn't been attempted
    return false;
  }
}

/**
 * Cleans up quiz session after completion
 * 
 * Removes a user's quiz session from memory after they've completed a quiz.
 * This prevents memory leaks and ensures users can take the quiz again later
 * if allowed by the application logic.
 * 
 * @param {Object} interaction - Discord interaction object with client reference
 * @param {string} userId - Discord user ID
 * @param {string} quizId - Unique quiz ID
 */
function cleanupQuizSession(interaction, userId, quizId) {
  // Validate parameters
  if (!interaction || !interaction.client) {
    console.error('Missing interaction or client in cleanupQuizSession');
    return;
  }
  
  if (!userId || !quizId) {
    console.error('Missing userId or quizId in cleanupQuizSession');
    return;
  }

  try {
    // Early exit if the quiz state Map doesn't exist
    if (!interaction.client.userQuizState || !(interaction.client.userQuizState instanceof Map)) {
      console.warn('No userQuizState map found in client, nothing to clean up');
      return;
    }
    
    console.log(`Attempting to clean up quiz session for user ${userId} and quiz ${quizId}`);
    
    // Convert keys to array for searching
    const sessionKeys = Array.from(interaction.client.userQuizState.keys());
    
    // Find the session ID by matching either uniqueQuizId or quizId
    // This allows compatibility with different quiz ID formats
    const sessionId = sessionKeys.find(key => {
      const session = interaction.client.userQuizState.get(key);
      return session && 
             session.userId === userId && 
             (session.uniqueQuizId === quizId || session.quizId === quizId);
    });
    
    if (sessionId) {
      console.log(`Found and removing completed quiz session: ${sessionId}`);
      interaction.client.userQuizState.delete(sessionId);
    } else {
      console.log(`No active session found for user ${userId} and quiz ${quizId}`);
    }
  } catch (error) {
    console.error('Error cleaning up quiz session:', error);
    // No need to re-throw - this is a cleanup function
  }
}

module.exports = {
  generateUniqueQuizId,
  createSessionId,
  findActiveQuizSession,
  createQuestionEmbed,
  createAnswerButtons,
  hasCompletedQuiz,
  hasAttemptedQuiz,
  cleanupQuizSession
};
