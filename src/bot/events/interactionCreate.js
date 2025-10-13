const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const quizUtils = require('../../utils/quizUtils');
const { createQuizFromUrl } = require('../../services/quiz');
const { saveQuiz } = require('../../services/storage');
const crypto = require('crypto');
const handleQuizContinueButton = require('./interactionCreateHandlers/quizContinueHandler');

/**
 * Quiz Global Cache Management
 * 
 * These global caches track quiz state and interactions throughout the Discord session.
 * They are initialized here to ensure they exist before any interactions occur.
 */

// Cache for storing quiz parameters (URL, token, chain, etc.) between modal submission and button clicks
if (!global.quizParamsCache) {
  global.quizParamsCache = new Map();
}

// Tracker for preventing duplicate handling of the same interaction
if (!global.interactionTracker) {
  global.interactionTracker = new Map();
}

// Tracker for ensuring we don't send multiple responses to the same interaction
if (!global.responseSent) {
  global.responseSent = new Map();
}

/**
 * Quiz Generation Lock Management
 * 
 * Prevents users from spam-clicking to generate multiple quizzes simultaneously.
 * Each lock automatically expires after 10 seconds as a safety measure.
 * This prevents memory leaks if the completion handler fails to remove a user.
 */
if (!global.quizGenerationInProgress) {
  global.quizGenerationInProgress = new Set();
}

// Add cleanup timers for responseSent map to prevent memory leaks
setInterval(() => {
  if (global.responseSent && global.responseSent.size > 0) {
    console.log(`Cleaning up responseSent map. Before: ${global.responseSent.size} entries`);
    const now = Date.now();
    let cleanupCount = 0;
    
    for (const [interactionId, entry] of global.responseSent.entries()) {
      // If entry is just a boolean (legacy), or if timestamp is older than 15 minutes, remove it
      if (typeof entry === 'boolean' || (entry.timestamp && now - entry.timestamp > 15 * 60 * 1000)) {
        global.responseSent.delete(interactionId);
        cleanupCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanupCount} old interaction responses`);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Add cleanup for quiz params cache to prevent memory leaks
setInterval(() => {
  if (global.quizParamsCache && global.quizParamsCache.size > 0) {
    console.log(`Cleaning up quizParamsCache. Before: ${global.quizParamsCache.size} entries`);
    const now = Date.now();
    let cleanupCount = 0;
    
    for (const [cacheKey, entry] of global.quizParamsCache.entries()) {
      // Remove entries older than 30 minutes
      if (entry.timestamp && now - entry.timestamp > 30 * 60 * 1000) {
        global.quizParamsCache.delete(cacheKey);
        cleanupCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanupCount} old quiz params entries`);
  }
}, 10 * 60 * 1000); // Run every 10 minutes

// Export the event handler
// Helper function to handle the quiz take process when a user clicks the Take Quiz button
async function handleQuizTake(interaction, quizParams) {
  const userId = interaction.user.id;
  try {
    const { url, chainName, fundingAmount } = quizParams;
    
    // Make sure to clear the quiz generation lock when this function exits
    // Using finally block later in this function
    
    // Use the uniqueQuizId if it exists (for newly created quizzes)
    // or fall back to the URL for backward compatibility
    const quizId = quizParams.uniqueQuizId || quizParams.quizId || url;
    
    // Initialize the completed quizzes tracking if it doesn't exist
    if (!interaction.client.completedQuizzes) {
      interaction.client.completedQuizzes = new Map();
    }
    
    // Check if user already attempted this quiz
    const quizAlreadyAttempted = await quizUtils.hasAttemptedQuiz(interaction, userId, quizId);
    
    if (quizAlreadyAttempted) {
      await interaction.reply({ 
        content: '⚠️ You have already attempted this quiz. Each quiz can only be taken once, even if you didn\'t complete it.', 
        ephemeral: true 
      });
      return;
    }
    
    // CRITICAL CHANGE: Start with a deferReply (ephemeral) rather than deferUpdate 
    // This creates a single ephemeral interaction we can update later
    await interaction.deferReply({ ephemeral: true });
    
    // First update: Show loading message
    const loadingResponse = await interaction.editReply({
      content: '⏳ Generating your quiz questions... This may take a moment.'
    });
    
    // Generate quiz questions from URL using the quiz service
    console.log('Generating quiz questions from URL:', url);
    let quizData;
    try {
      quizData = await createQuizFromUrl(url, { numQuestions: 3 });
      
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        await interaction.editReply({
          content: '❌ Failed to generate quiz questions from the provided URL. Please try again later.'
        });
        return;
      }
    } catch (error) {
      // Provide more specific error messages based on error type
      let errorMessage = '❌ Failed to generate quiz questions.';
      
      if (error.message.includes('Content too short')) {
        errorMessage = '❌ The content from this URL is too short or lacks sufficient information to create a quiz. Please try using a URL with more detailed content, such as an article or documentation page.';
      } else if (error.message.includes('Unable to fetch content')) {
        errorMessage = '❌ Unable to access the content from this URL. The site might be blocking our request or the URL might be invalid. Please try a different URL.';
      } else if (error.message.includes('Invalid URL format')) {
        errorMessage = '❌ The URL format is invalid. Please provide a complete URL including https:// or http://.';
      }
      
      await interaction.editReply({ content: errorMessage });
      return;
    }
    
    console.log('Quiz questions generated successfully, storing quiz state');
    
    // Create a Map for storing multiple quiz states per user
    if (!interaction.client.userQuizState) {
      interaction.client.userQuizState = new Map();
    }
    
    // Create a quiz state for this quiz instance
    const userQuizState = {
      url,
      quizId,
      uniqueQuizId: quizId, // Store the unique quiz ID
      userId,
      score: 0,
      questions: quizData.questions,
      currentQuestionIndex: 0,
      startTime: Date.now(),
      userAnswers: [],
      fundingAmount,
      chainName
    };
    
    // Generate a unique session identifier combining user and quiz
    // This allows users to take multiple quizzes simultaneously
    const sessionId = quizUtils.createSessionId(userId, quizId);
    
    // Save the quiz state using the unique session ID
    interaction.client.userQuizState.set(sessionId, userQuizState);
    
    // Get user's wallet address for tracking
    let userWallet = null;
    try {
      const { getUserWallet } = require('../../account-kit/sdk');
      userWallet = await getUserWallet(userId);
      if (userWallet) {
        console.log(`✅ Retrieved wallet for quiz taker ${userId}: ${userWallet}`);
      } else {
        console.log(`⚠️  No wallet found for quiz taker ${userId}`);
      }
    } catch (walletError) {
      console.log(`⚠️  Wallet retrieval failed for quiz taker ${userId}:`, walletError.message);
    }

    // Record the quiz attempt in the database
    try {
      if (interaction.client.quizDb) {
        await interaction.client.quizDb.QuizAttempt.create({
          userId,
          quizId,
          guildId: interaction.guildId || null,
          userWalletAddress: userWallet,
          attemptedAt: new Date(),
          completed: false
        });
        console.log(`Quiz attempt recorded for user ${userId} on quiz ${quizId} with wallet ${userWallet || 'none'}`);
      }
    } catch (error) {
      // Log but continue - this is not critical for quiz functionality
      console.error('Error recording quiz attempt:', error);
    }
    
    // Get the first question ready
    const questionIndex = 0;
    const question = quizData.questions[questionIndex];
    console.log('Preparing to show first question');
    
    // Create the question embed
    const questionEmbed = quizUtils.createQuestionEmbed(
      question, 
      questionIndex, 
      quizData.questions.length
    );
    
    // Create buttons for each answer option
    const actionRow = new ActionRowBuilder();
    
    // Ensure we have answer options
    const options = question.options || [];
    if (options.length === 0) {
      console.error('Question has no answer options');
      await interaction.editReply({
        content: 'Error: The generated question has no answer options. Please try again.'
      });
      return;
    }
    
    // Add a button for each answer option (max 5)
    for (let i = 0; i < Math.min(options.length, 5); i++) {
      const answerButton = new ButtonBuilder()
        .setCustomId(`quiz_answer:${questionIndex}:${i}`)
        .setLabel(options[i].substring(0, 80)) // Discord has an 80-char limit for button labels
        .setStyle(ButtonStyle.Primary);
      
      actionRow.addComponents(answerButton);
    }
    
    // CRITICAL: Update the existing ephemeral reply with the quiz question
    // This completely replaces the loading message with our first question
    await interaction.editReply({
      content: '', // Remove the loading text
      embeds: [questionEmbed],
      components: [actionRow]
    });
    
    console.log('Successfully displayed first quiz question, replacing loading message');
  } catch (error) {
    console.error('Error handling quiz_take button:', error);
    try {
      await interaction.followUp({
        content: 'There was an error generating your quiz. Please try again later.',
        ephemeral: true
      });
    } catch (followUpError) {
      console.error('Failed to send error message:', followUpError);
    }
  } finally {
    // Clean up by removing the user from the in-progress set
    // This prevents them from being permanently locked out if there was an error
    if (global.quizGenerationInProgress && userId) {
      console.log(`Clearing quiz generation lock for user ${userId}`);
      global.quizGenerationInProgress.delete(userId);
    }
  }
}

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    // Helper function to safely respond to interactions
    function setupSafeRespond(interaction) {
      interaction.safeRespond = async function(content, options = {}) {
        try {
          if (this.replied) {
            await this.followUp({ ...options, content });
          } else if (this.deferred) {
            await this.editReply({ ...options, content });
          } else {
            await this.reply({ ...options, content });
          }
          return true;
        } catch (error) {
          console.error(`Error in safeRespond:`, error);
          return false;
        }
      };
    }

    // Apply safe respond to all interactions
    setupSafeRespond(interaction);
    
    // Handle Chat Input Commands (Slash Commands)
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
        return;
      }
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}`, error);
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
      return;
    }
    
    // Handle Button Interactions
    if (interaction.isButton()) {
      console.log(`Button interaction received: ${interaction.customId}`);
      
      // Handle poll creation buttons
      if (interaction.customId.startsWith('create-poll:') || interaction.customId.startsWith('poll-vote:')) {
        const quizCommand = interaction.client.commands.get('agent') || interaction.client.commands.get('quiz') || interaction.client.commands.get('acequiz') || interaction.client.commands.get('mother');
        if (quizCommand && typeof quizCommand.buttonInteraction === 'function') {
          console.log(`Routing ${interaction.customId.split(':')[0]} to quiz command buttonInteraction handler`);
          await quizCommand.buttonInteraction(interaction);
        } else {
          console.error('Error: Mother command or buttonInteraction handler not found');
          await interaction.reply({
            content: 'There was an error processing this button. Please try again later.',
            ephemeral: true
          });
        }
        return;
      }
      
      // Handle quiz continue button from wallet status UI
      if (interaction.customId.startsWith('quiz:continue:')) {
        try {
          // Parse the tracking ID from the custom ID
          const [_, action, trackingId] = interaction.customId.split(':');
          
          // Route to the quiz continue button handler
          await handleQuizContinueButton(interaction, trackingId);
        } catch (error) {
          console.error('Error processing quiz continue button:', error);
          
          // Handle errors
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'There was an error processing your request. Please try again.',
              ephemeral: true
            });
          }
        }
        return;
      }
      

      
      // Handle quiz answer buttons
      if (interaction.customId.startsWith('quiz_answer:')) {
        try {
          // Parse the question index and selected option from the custom ID
          const [_, questionIndex, selectedOption] = interaction.customId.split(':');
          const userId = interaction.user.id;
          
          // Find the active quiz session for this user
          const activeQuizSession = quizUtils.findActiveQuizSession(
            interaction.client, 
            userId, 
            parseInt(questionIndex)
          );
          
          if (!activeQuizSession) {
            await interaction.reply({
              content: 'Could not find an active quiz session for this question. Your session may have expired.',
              ephemeral: true
            });
            return;
          }
          
          // Mark the user's answer
          const currentQuestion = activeQuizSession.questions[parseInt(questionIndex)];
          const correct = parseInt(selectedOption) === currentQuestion.correctOptionIndex;
          
          // Update the quiz state
          activeQuizSession.userAnswers.push({
            questionIndex: parseInt(questionIndex),
            selectedOption: parseInt(selectedOption),
            correct
          });
          
          if (correct) {
            activeQuizSession.score++;
          }
          
          // Skip feedback - but immediately disable all buttons to prevent multiple answers
          // Get the current components and disable all buttons
          const message = await interaction.message;
          const components = message.components;
          
          // Disable all buttons in each row
          const disabledComponents = components.map(row => {
            const newRow = new ActionRowBuilder();
            // Process each component in the row, marking as disabled
            row.components.forEach(component => {
              // Create a new disabled button with the same properties
              newRow.addComponents(
                ButtonBuilder.from(component).setDisabled(true)
              );
            });
            return newRow;
          });
          
          // Update the message with disabled buttons
          try {
            await interaction.update({
              components: disabledComponents
            });
          } catch (updateError) {
            console.log('Failed to update components, the interaction may have expired:', updateError);
            // We'll continue processing the answer anyway, but may not be able to visually update the buttons
          }
          
          // Update question index and check if quiz is complete
          const nextQuestionIndex = parseInt(questionIndex) + 1;
          activeQuizSession.currentQuestionIndex = nextQuestionIndex;
          
          // Save updated state
          const sessionId = quizUtils.createSessionId(userId, activeQuizSession.quizId);
          interaction.client.userQuizState.set(sessionId, activeQuizSession);
          
          // Check if this was the last question
          if (nextQuestionIndex >= activeQuizSession.questions.length) {
            // Quiz is complete - show results
            const totalQuestions = activeQuizSession.questions.length;
            const score = activeQuizSession.score;
            const percentage = (score / totalQuestions) * 100;
            
            // Create simplified completion embed
            const completionEmbed = new EmbedBuilder()
              .setColor('#2196F3')
              .setTitle('🎓 Quiz Complete!')
              .setDescription(`You've completed the quiz`)
              .addFields(
                { name: 'Score', value: `${score}/${totalQuestions} (${percentage.toFixed(1)}%)` }
              )
              .setColor(0x00ff00);

            await interaction.editReply({
              embeds: [completionEmbed],
              components: [] // Remove all buttons from the previous question
            });
            
            // Record quiz completion
            if (interaction.client.quizDb) {
              try {
                // Get wallet address from the quiz attempt record
                let userWallet = null;
                try {
                  const attemptRecord = await interaction.client.quizDb.QuizAttempt.findOne({
                    where: { 
                      userId: userId,
                      quizId: activeQuizSession.quizId
                    }
                  });
                  userWallet = attemptRecord ? attemptRecord.userWalletAddress : null;
                } catch (walletError) {
                  console.log(`⚠️  Could not retrieve wallet from attempt record:`, walletError.message);
                }

                // Create quiz completion record
                await interaction.client.quizDb.QuizCompletion.create({
                  userId: userId,
                  quizId: activeQuizSession.quizId,
                  guildId: interaction.guildId || null,
                  userWalletAddress: userWallet,
                  score: score,
                  totalQuestions: totalQuestions,
                  completedAt: new Date()
                });
                
                // Update quiz attempt record to mark it as completed
                await interaction.client.quizDb.QuizAttempt.update(
                  { completed: true },
                  { 
                    where: { 
                      userId: userId,
                      quizId: activeQuizSession.quizId
                    }
                  }
                );
                console.log(`Quiz attempt marked as completed for user ${userId} on quiz ${activeQuizSession.quizId} with wallet ${userWallet || 'none'}`);

                // Fire-and-forget: notify Intuition integration service (decoupled)
                try {
                  const { publishQuizCompletion } = require('../../integrations/intuitionPublisher');
                  const completedAtIso = new Date().toISOString();
                  publishQuizCompletion({
                    userAddress: userWallet,
                    communityId: interaction.guildId || null,
                    quizId: activeQuizSession.quizId,
                    completedAt: completedAtIso,
                  });
                } catch (notifyError) {
                  console.error('[IntuitionPublisher] Hook failed to enqueue', notifyError.message);
                }
              } catch (dbError) {
                console.error('Error saving quiz completion to database:', dbError);
              }
            }
            
            // Fallback for in-memory tracking
            if (!interaction.client.completedQuizzes.has(userId)) {
              interaction.client.completedQuizzes.set(userId, []);
            }
            const completedQuizzes = interaction.client.completedQuizzes.get(userId);
            if (!completedQuizzes.includes(activeQuizSession.quizId)) {
              completedQuizzes.push(activeQuizSession.quizId);
            }
            
            // Clean up the session
            quizUtils.cleanupQuizSession(interaction, userId, activeQuizSession.quizId);
            
            // Show completion message
            try {
              await interaction.editReply({
                embeds: [completionEmbed],
                components: [] // No buttons
              });
            } catch (completionError) {
              console.log('Failed to show quiz completion, interaction may have expired:', completionError);
              
              // Try to send a new message if we can't edit reply
              if (interaction.channel) {
                await interaction.channel.send({
                  content: 'Your quiz is now complete!',
                  embeds: [completionEmbed],
                  components: [] // No buttons
                });
              }
            }
            
          } else {
            // Show next question after a brief delay - use a shorter delay to avoid token expiration
            setTimeout(async () => {
              try {
                const nextQuestion = activeQuizSession.questions[nextQuestionIndex];
                
                // Create the question embed
                const questionEmbed = quizUtils.createQuestionEmbed(
                  nextQuestion, 
                  nextQuestionIndex, 
                  activeQuizSession.questions.length
                );
                
                // Create buttons for each answer option
                const actionRow = quizUtils.createAnswerButtons(
                  nextQuestion.options, 
                  nextQuestionIndex
                );
                
                // Try to update the original message with the next question
                try {
                  // Update the original message with the next question
                  await interaction.editReply({
                    content: '',
                    embeds: [questionEmbed],
                    components: [actionRow]
                  });
                } catch (editError) {
                  // If we can't edit the reply (token expired, etc), try sending a new message
                  console.log('Could not edit reply, interaction may have expired:', editError);
                  
                  // Create a new ephemeral message for this user with the next question
                  // Find the channel where this interaction happened
                  if (interaction.channel) {
                    await interaction.channel.send({
                      content: 'Your quiz session is continuing with the next question:',
                      embeds: [questionEmbed],
                      components: [actionRow],
                      ephemeral: true
                    });
                  }
                }
              } catch (nextError) {
                console.error('Error showing next question:', nextError);
                try {
                  await interaction.editReply({ 
                    content: 'There was an error loading the next question.'
                  });
                } catch (finalError) {
                  console.error('Failed to send error message, interaction may have expired', finalError);
                }
              }
            }, 1000); // 1 second delay - reduced to avoid token expiration
          }
        } catch (error) {
          console.error('Error processing quiz answer:', error);
          await interaction.followUp({ 
            content: 'There was an error processing your answer. Please try again.', 
            ephemeral: true 
          });
        }
        return;
      }
      

      
      // Handle quiz take button (start quiz)
      if (interaction.customId.startsWith('quiz_take:')) {
        const userId = interaction.user.id;
        const uniqueQuizId = interaction.customId.split(':')[1];
        const quizParams = global.quizParamsCache.get(uniqueQuizId);

        // Check if user is already generating a quiz
        if (global.quizGenerationInProgress && global.quizGenerationInProgress.has(userId)) {
          try {
            await interaction.reply({ 
              content: '⚠️ You already have a quiz being generated. Please wait for it to complete before starting another one.', 
              ephemeral: true 
            });
          } catch (replyError) {
            console.error('Failed to send duplicate quiz warning:', replyError);
          }
          return;
        }
        
        if (!quizParams) {
          try {
            await interaction.reply({ 
              content: 'Quiz configuration was not found. Please try creating a new quiz.', 
              ephemeral: true 
            });
          } catch (replyError) {
            console.error('Failed to send quiz config error:', replyError);
          }
          return;
        }
        
        // Initialize the in-progress set if it doesn't exist
        if (!global.quizGenerationInProgress) {
          global.quizGenerationInProgress = new Set();
        }
        
        // Add user to the in-progress set before starting generation
        global.quizGenerationInProgress.add(userId);
        
        // Set a 10-second timeout to automatically remove the lock
        // This prevents users from being permanently locked if there's an error
        setTimeout(() => {
          if (global.quizGenerationInProgress && global.quizGenerationInProgress.has(userId)) {
            console.log(`Auto-releasing quiz generation lock for user ${userId} after 10-second timeout`);
            global.quizGenerationInProgress.delete(userId);
          }
        }, 10000);
        
        try {
          await handleQuizTake(interaction, quizParams);
        } catch (error) {
          console.error('Error in quiz take handler:', error);
          // Make sure to remove user from in-progress set on error
          if (global.quizGenerationInProgress) {
            global.quizGenerationInProgress.delete(userId);
          }
          
          // Attempt to notify user of error if we haven't already
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'There was an error generating your quiz. Please try again later.',
                ephemeral: true
              });
            } else if (interaction.deferred) {
              await interaction.editReply({
                content: 'There was an error generating your quiz. Please try again later.',
                ephemeral: true
              });
            }
          } catch (replyError) {
            console.error('Error sending error response:', replyError);
            // If all else fails, try to send a follow-up message
            try {
              await interaction.followUp({
                content: 'There was an error processing your quiz. Please try again.',
                ephemeral: true
              });
            } catch (followupError) {
              console.error('Failed to send followup error message:', followupError);
            }
          }
        }
        return;
      }
      
      // Default handler for other buttons
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "This button interaction isn't implemented yet.",
          ephemeral: true
        });
      }
      return;
    }
    
    // Handle Modal Submissions
    if (interaction.isModalSubmit()) {
      console.log(`Modal submission received: ${interaction.customId}`);
      
      /**
       * Quiz Modal Submission Handler
       * 
       * This handler processes submissions from the quiz creation modal (from /mother command)
       * It routes to the dedicated mother quiz handler for MotherFactory integration.
       */
      if (interaction.customId.startsWith('quiz-creation-')) {
        try {
          const { handleMotherQuizSubmission } = require('../handlers/motherQuizHandler');
          await handleMotherQuizSubmission(interaction);
        } catch (error) {
          console.error('Error in mother quiz submission:', error);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'There was an error processing your quiz creation. Please try again later.',
                ephemeral: true
              });
            } else if (interaction.deferred) {
              await interaction.editReply({
                content: 'There was an error processing your quiz creation. Please try again later.',
                ephemeral: true
              });
            }
          } catch (replyError) {
            console.error('Failed to send error response:', replyError);
          }
        }
        return;
      }
      

      
      // Handle poll creation modal
      if (interaction.customId.startsWith('poll-creation-')) {
        const quizCommand = interaction.client.commands.get('agent') || interaction.client.commands.get('quiz') || interaction.client.commands.get('acequiz') || interaction.client.commands.get('mother');
        if (quizCommand && typeof quizCommand.modalSubmit === 'function') {
          console.log('Routing poll modal submission to quiz command');
          await quizCommand.modalSubmit(interaction);
        } else {
          console.error('Error: Mother command or modalSubmit handler not found');
          await interaction.reply({
            content: 'There was an error processing your poll. Please try again later.',
            ephemeral: true
          });
        }
        return;
      }
      
      // Handle text message modal
      if (interaction.customId === 'text_message_modal') {
        await interaction.reply({
          content: 'Your message was received! (Basic functionality)',
          ephemeral: true
        });
        return;
      }
      
      // Default handler for other modals
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Your submission was received.',
          ephemeral: true
        });
      }
      return;
    }
    
    // Handle other interaction types
    if (!interaction.replied && !interaction.deferred) {
      console.log(`Unhandled interaction type: ${interaction.type}`);
    }
  }
};
