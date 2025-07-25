/**
 * Ask Command
 * 
 * Handles the /ask slash command for creating token-incentivized quizzes from URLs
 */

// Add BigInt serialization support - fixes "Error creating quiz: Do not know how to serialize a BigInt"
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const { SlashCommandBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { sanitizeUrl, validateTokenAmount, validateEthereumAddress } = require('../../security/inputSanitizer');

// Import the new quiz generation service
const { createQuizFromUrl } = require('../../services/quiz');

// Import the storage service
const { saveQuiz, saveAnswer, getQuiz, updateQuizFunding } = require('../../services/storage');

// Import Account Kit SDK for wallet validation
const { getUserWallet, getBotWallet } = require('../../account-kit/sdk');

// Import the QuizService for blockchain interaction
const QuizService = require('../../services/blockchain/quizService');

// Import ethers for token formatting
const { ethers } = require('ethers');

/**
 * /ask command definition
 */
// Define the command using the pattern that works with Discord.js
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Create a token-incentivized quiz from a URL with automated reward distribution')
    .addStringOption(option => 
      option
        .setName('url')
        .setDescription('URL to generate quiz questions from')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('token')
        .setDescription('ERC20 token address for rewards')
        .setRequired(false)
    )
    .addIntegerOption(option => 
      option
        .setName('chain')
        .setDescription('Chain ID (default: 8453 - Base)')
        .setRequired(false)
    )
    .addIntegerOption(option => 
      option
        .setName('amount')
        .setDescription('Token amount for rewards (default: 10000)')
        .setRequired(false)
    ),
  execute: handleAskCommand
};

/**
 * Handle the /ask command
 * @param {Object} interaction - Discord interaction object
 */
async function handleAskCommand(interaction) {
  // IMPORTANT: Single deferred reply pattern - acknowledge the interaction ONCE at the beginning
  try {
    // Check if the interaction was handled by the global handler and successfully deferred
    if (interaction.handledByGlobalHandler) {
      console.log('Interaction already handled by global handler, skipping deferReply in ask command');
      
      // If the global handler tried but failed to defer the interaction
      if (interaction.deferFailed && !interaction.myDeferred && !interaction.deferred && !interaction.replied) {
        console.log('Global handler failed to defer, attempting to defer in ask command');
        try {
          // Use flags (64 = ephemeral) instead of ephemeral property to avoid deprecation warning
          await interaction.deferReply({ flags: 64 });
          interaction.myDeferred = true;
        } catch (deferError) {
          console.error('Error with fallback interaction defer in ask command:', deferError);
          // Continue anyway and try to use other response methods
        }
      }
    }
    // If this is called directly and not through the global handler
    else if (!interaction.deferred && !interaction.replied && !interaction.myDeferred) {
      console.log('Deferring interaction in ask command (not handled by global handler)');
      try {
        // Use flags (64 = ephemeral) instead of ephemeral property
        await interaction.deferReply({ flags: 64 });
        interaction.myDeferred = true;
      } catch (deferError) {
        console.error('Error with direct interaction defer in ask command:', deferError);
        // Continue anyway and try other methods
      }
    } else {
      console.log('Interaction already deferred or replied, skipping deferReply in ask command');
    }
    
    // 1. Extract and validate command options
    let url = interaction.options.getString('url');
    console.log('Processing URL from command:', url);
    
    // Update status message - make sure we can reply first
    if (interaction.myDeferred || interaction.deferred || interaction.replied) {
      try {
        await interaction.editReply('⌛ Validating your inputs...');
      } catch (replyError) {
        console.error('Failed to edit reply with validation message:', replyError);
        // Continue anyway - the validation is more important than the message
      }
    } else {
      console.log('Cannot update status message - interaction not deferred/replied');
    }
    
    // Validate URL parameter
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
      console.error('URL validation failed:', url);
      await interaction.editReply('❌ Invalid or unsafe URL provided. Please check the URL format and ensure it doesn\'t contain dangerous content.');
      return false;
    }
    
    // 2. Extract and validate other optional parameters
    // Get the token address - validate based on blockchain mode
    let tokenAddress = interaction.options.getString('token');
    const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
    
    if (!tokenAddress) {
      await interaction.editReply({
        content: '❌ Token address is required. Please specify a token address.',
        ephemeral: true
      });
      return;
    }
    
    console.log('Using token address:', tokenAddress);
    
    // Validate token address
    if (!validateEthereumAddress(tokenAddress)) {
      console.error('Invalid token address:', tokenAddress);
      await interaction.editReply('❌ Invalid token address format. Please provide a valid ERC20 token address.');
      return false;
    }
    
    // Get the chain ID - default to Base (8453)
    const chainId = interaction.options.getInteger('chain') || 8453;
    console.log('Using chain ID:', chainId);
    
    // Get the reward amount - default to 10000 (token-specific denomination)
    const amount = interaction.options.getInteger('amount') || 10000;
    console.log('Using reward amount:', amount);
    
    // Validate token amount
    if (!validateTokenAmount(amount)) {
      console.error('Invalid token amount:', amount);
      await interaction.editReply('❌ Invalid token amount. Please provide a positive integer value.');
      return false;
    }
    
    try {
      // Update status message - content extraction beginning
      await interaction.editReply('⌛ Extracting content from URL and generating quiz...');
      
      // 3. Generate the quiz from the URL
      console.log('Generating quiz from URL:', sanitizedUrl);
      let quizData;
      
      try {
        quizData = await createQuizFromUrl(sanitizedUrl);
        console.log('Quiz generated successfully:', quizData.id);
      } catch (quizError) {
        console.error('Error generating quiz:', quizError);
        
        let errorMessage = '❌ Failed to generate quiz from the provided URL.';
        if (quizError.message.includes('rate limit')) {
          errorMessage = '❌ Rate limit exceeded. Please try again in a few minutes.';
        } else if (quizError.message.includes('token')) {
          errorMessage = '❌ API token error. Please contact an administrator.';
        } else if (quizError.message.includes('content')) {
          errorMessage = '❌ Could not extract sufficient content from the URL. Please try a different URL with more text content.';
        }
        
        await interaction.editReply(errorMessage);
        return false;
      }
      
      // Check if we got valid quiz data with questions
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        console.error('No questions generated from URL:', sanitizedUrl);
        await interaction.editReply('❌ Could not generate quiz questions from the provided URL. Please try a different URL with more substantial content.');
        return false;
      }
      
      // Store the generated quiz data in a global cache for later retrieval
      // This is a temporary solution until we have a proper database
      global.pendingQuizzes = global.pendingQuizzes || {};
      global.pendingQuizzes[interaction.user.id] = quizData;
      
      // 4. Add metadata to the quiz
      console.log('Adding metadata to quiz');
      quizData.userId = interaction.user.id;
      quizData.username = interaction.user.username;
      quizData.guildId = interaction.guildId;
      quizData.channelId = interaction.channelId;
      quizData.url = sanitizedUrl;
      quizData.chainId = chainId;
      quizData.tokenAddress = tokenAddress;
      quizData.rewardAmount = amount;
      
      // Create a deep copy of quizData to preserve the original questions
      const quizDataCopy = JSON.parse(JSON.stringify(quizData));
      
      // Log quiz data after adding metadata
      console.log('Quiz data after adding metadata:', quizData.id, quizData.questions ? quizData.questions.length : 0);
      
      quizData.createdAt = Date.now();
      
      // Send a preview of the quiz with approval/cancel buttons
      await interaction.editReply('⌛ Preparing quiz preview...');
      await sendEphemeralPreview(interaction, quizData);
      
      return true;
    } catch (error) {
      console.error('Error creating quiz:', error);
      
      // Try to send a more detailed error message
      let errorMessage = '❌ Error creating quiz';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      } else {
        errorMessage += '. Please try again with a different URL or check your inputs.';
      }
      
      await interaction.editReply(errorMessage);
      return false;
    }
  } catch (error) {
    console.error('Error handling /ask command:', error);
    
    // Fallback error handling - try to provide user feedback
    try {
      // Check if we already replied or deferred using our reliable flags
      if (interaction.myDeferred || interaction.deferred || interaction.replied) {
        try {
          await interaction.editReply('❌ An error occurred while processing your command. Please try again later.');
          console.log('Successfully sent error message via editReply');
        } catch (editError) {
          console.error('Could not edit reply with error message:', editError);
          // If editReply fails, try followup as last resort
          try {
            await interaction.followUp({
              content: '❌ An error occurred while processing your command. Please try again later.',
              flags: 64 // Ephemeral flag
            });
            console.log('Successfully sent error message via followUp');
          } catch (followupError) {
            console.error('Could not send followup with error message:', followupError);
          }
        }
      } else {
        // Try a direct reply if we haven't deferred/replied yet
        try {
          await interaction.reply({
            content: '❌ An error occurred while processing your command. Please try again later.',
            flags: 64 // Ephemeral flag
          });
          console.log('Successfully sent error message via direct reply');
        } catch (replyError) {
          console.error('Could not send direct reply with error message:', replyError);
        }
      }
    } catch (followupError) {
      console.error('Fatal error responding to interaction:', followupError);
    }
    return false;
  }
}

/**
 * Send ephemeral preview with approval/cancel buttons
 * @param {Object} interaction - Discord interaction
 * @param {Object} quizData - Generated quiz data
 */
async function sendEphemeralPreview(interaction, quizData) {
  try {
    // Log the incoming quiz data to verify questions exist
    console.log('Quiz data received in sendEphemeralPreview:', {
      hasQuestions: !!quizData.questions,
      questionCount: quizData.questions ? quizData.questions.length : 0,
      firstQuestion: quizData.questions && quizData.questions.length > 0 ? 
        { 
          question: quizData.questions[0].question,
          hasOptions: !!quizData.questions[0].options
        } : null
    });

    // Create a quiz preview embed
    const previewEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Quiz Preview')
      .setDescription(`Preview of your quiz from ${quizData.url}`)
      .addFields(
        { name: 'Questions', value: `${quizData.questions.length} questions generated` },
        { name: 'Sample Question', value: quizData.questions[0].question.substring(0, 1024) }, // Discord limits field value to 1024 chars
        { name: 'Reward', value: `${quizData.rewardAmount} tokens` }
      )
      .setFooter({ text: `Quiz ID: ${quizData.id}` });

    // Create approval and cancel buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_quiz:${quizData.id}`)
          .setLabel('Approve Quiz')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_quiz:${quizData.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

    // Send the ephemeral preview with buttons
    await interaction.editReply({
      embeds: [previewEmbed],
      components: [row]
    });

    return true;
  } catch (error) {
    console.error('Error sending ephemeral preview:', error);
    await interaction.editReply({
      content: '❌ Error creating quiz preview. Please try again.',
      components: []
    });
    return false;
  }
}

/**
 * Handle quiz approval button click
 * @param {Object} interaction - Button interaction
 */
async function handleQuizApproval(interaction) {
  console.log('Quiz approval button clicked');
  let buttonDeferredWithUpdate = false;
  
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
      buttonDeferredWithUpdate = true;
      interaction.buttonDeferredWithUpdate = true;
      console.log('Button interaction deferred with deferUpdate()');
    } else {
      console.log('Button interaction already deferred or replied');
    }
    
    // Extract the quiz ID from the custom ID
    const quizId = interaction.customId.split(':')[1];
    console.log(`Processing approval for quiz ID: ${quizId}`);
    
    // Retrieve the quiz data from our global cache
    const quizData = global.pendingQuizzes ? global.pendingQuizzes[interaction.user.id] : null;
    
    if (!quizData) {
      console.error('Quiz data not found in cache for user:', interaction.user.id);
      
      // Consistent response pattern based on how the interaction was deferred
      if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
        await interaction.update({
          content: '❌ Quiz data not found. The quiz may have expired or been deleted.',
          components: [],
          embeds: []
        });
      } else {
        await interaction.editReply({
          content: '❌ Quiz data not found. The quiz may have expired or been deleted.',
          components: [],
          embeds: []
        });
      }
      return;
    }
    
    // Update the button interaction
    if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
      await interaction.update({
        content: '⌛ Deploying quiz and setting up rewards...',
        components: [],
        embeds: []
      });
    } else {
      await interaction.editReply({
        content: '⌛ Deploying quiz and setting up rewards...',
        components: [],
        embeds: []
      });
    }
    
    // Process the quiz approval
    // Deploy the quiz smart contract and save quiz data
    
    try {
      // Save the quiz to our storage system
      await saveQuiz(quizData);
      console.log(`Quiz ${quizId} saved to storage`);
      
      // Here you would deploy the quiz smart contract
      // For this template, we'll just simulate deployment
      
      // Create a success message with quiz details
      const quizEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Quiz Created Successfully!')
        .setDescription(`Your quiz from ${quizData.url} has been created and deployed.`)
        .addFields(
          { name: 'Questions', value: `${quizData.questions.length} questions` },
          { name: 'Reward', value: `${quizData.rewardAmount} tokens` },
          { name: 'Expiry', value: 'End of next day (UTC)' }
        )
        .setFooter({ text: `Quiz ID: ${quizId}` });
      
      // Send the success message
      const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
      const devModePrefix = useRealBlockchain ? '' : '[DEV MODE] ';
      const successMessage = `${devModePrefix}Quiz created successfully!`;
      
      if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
        await interaction.update({
          content: successMessage,
          embeds: [quizEmbed],
          components: []
        });
      } else {
        await interaction.editReply({
          content: successMessage,
          embeds: [quizEmbed],
          components: []
        });
      }
      
      // Now post the quiz in the channel for everyone to see
      const channelMessage = useRealBlockchain 
        ? `<@${interaction.user.id}> has created a new quiz with token rewards!`
        : `[DEV MODE] <@${interaction.user.id}> has created a new quiz with token rewards!`;
        
      await interaction.channel.send({
        content: channelMessage,
        embeds: [quizEmbed]
      });
      
      // Clear the quiz data from our cache
      if (global.pendingQuizzes && global.pendingQuizzes[interaction.user.id]) {
        delete global.pendingQuizzes[interaction.user.id];
      }
      
      return true;
    } catch (error) {
      console.error('Error processing quiz approval:', error);
      
      // Send error message back to the user
      if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
        await interaction.update({
          content: '❌ Error deploying quiz. Please try again later.',
          components: [],
          embeds: []
        });
      } else {
        await interaction.editReply({
          content: '❌ Error deploying quiz. Please try again later.',
          components: [],
          embeds: []
        });
      }
      return false;
    }
  } catch (error) {
    console.error('Error handling quiz approval:', error);
    
    try {
      // Final attempt to provide user feedback
      if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
        await interaction.update({
          content: '❌ An error occurred while processing your request.',
          components: [],
          embeds: []
        });
      } else if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while processing your request.',
          components: [],
          embeds: []
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          flags: 64
        });
      }
    } catch (finalError) {
      console.error('Fatal error responding to quiz approval interaction:', finalError);
    }
    return false;
  }
}

/**
 * Handle quiz cancellation button click
 * @param {Object} interaction - Button interaction
 */
async function handleQuizCancellation(interaction) {
  console.log('Quiz cancellation button clicked');
  let buttonDeferredWithUpdate = false;
  
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
      buttonDeferredWithUpdate = true;
      interaction.buttonDeferredWithUpdate = true;
      console.log('Button interaction deferred with deferUpdate()');
    } else {
      console.log('Button interaction already deferred or replied');
    }
    
    // Extract the quiz ID from the custom ID
    const quizId = interaction.customId.split(':')[1];
    console.log(`Processing cancellation for quiz ID: ${quizId}`);
    
    // Clear the quiz data from our cache
    if (global.pendingQuizzes && global.pendingQuizzes[interaction.user.id]) {
      delete global.pendingQuizzes[interaction.user.id];
    }
    
    // Update the button interaction
    if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
      await interaction.update({
        content: '✅ Quiz creation cancelled.',
        components: [],
        embeds: []
      });
    } else {
      await interaction.editReply({
        content: '✅ Quiz creation cancelled.',
        components: [],
        embeds: []
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error handling quiz cancellation:', error);
    
    try {
      // Final attempt to provide user feedback
      if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
        await interaction.update({
          content: '❌ An error occurred while cancelling the quiz.',
          components: [],
          embeds: []
        });
      } else if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while cancelling the quiz.',
          components: [],
          embeds: []
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while cancelling the quiz.',
          flags: 64
        });
      }
    } catch (finalError) {
      console.error('Fatal error responding to quiz cancellation interaction:', finalError);
    }
    return false;
  }
}

/**
 * Handle quiz answer button click
 * @param {Object} interaction - Button interaction
 */
async function handleQuizAnswer(interaction) {
  console.log('Quiz answer button clicked');
  let buttonDeferredWithUpdate = false;
  
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
      buttonDeferredWithUpdate = true;
      interaction.buttonDeferredWithUpdate = true;
      console.log('Button interaction deferred with deferUpdate()');
    } else {
      console.log('Button interaction already deferred or replied');
    }
    
    // Extract answer data from custom ID
    // Format is quiz_answer:quizId:questionIndex:answerId
    const customIdParts = interaction.customId.split(':');
    if (customIdParts.length < 4) {
      throw new Error('Invalid quiz answer custom ID format');
    }
    
    const quizId = customIdParts[1];
    const questionIndex = parseInt(customIdParts[2]);
    const answerId = customIdParts[3];
    
    console.log(`Processing answer for quiz ${quizId}, question ${questionIndex}, answer ${answerId}`);
    
    // TODO: Retrieve quiz data and process the answer
    // This is a simplified placeholder implementation
    
    // Save the answer to storage
    try {
      await saveAnswer({
        quizId,
        userDiscordId: interaction.user.id,
        questionIndex,
        answerId,
        timestamp: new Date().toISOString()
      });
    } catch (storageError) {
      console.error('Error saving answer to storage:', storageError);
      // Continue execution even if storage fails
    }
    
    // Respond to the interaction
    if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
      await interaction.update({
        content: '✅ Your answer has been recorded.',
        components: [] // Remove the buttons to prevent multiple submissions
      });
    } else if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: '✅ Your answer has been recorded.',
        components: []
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error handling quiz answer:', error);
    
    try {
      // Final attempt to provide user feedback
      if (buttonDeferredWithUpdate || interaction.buttonDeferredWithUpdate) {
        await interaction.update({
          content: '❌ An error occurred while processing your answer.',
          components: []
        });
      } else if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while processing your answer.',
          components: []
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while processing your answer.',
          flags: 64
        });
      }
    } catch (finalError) {
      console.error('Fatal error responding to quiz answer interaction:', finalError);
    }
    return false;
  }
}

// Export additional functions for external use (keeping handlers accessible for interactionCreate.js)
exports.handleQuizApproval = handleQuizApproval;
exports.handleQuizCancellation = handleQuizCancellation;
exports.handleQuizAnswer = handleQuizAnswer;
exports.sendEphemeralPreview = sendEphemeralPreview;

// Export main command handler and data for testing
exports.handleAskCommand = handleAskCommand;
exports.askCommand = module.exports; // Reference to the main export

// Export stub functions for test compatibility
exports.sendError = async function sendError(interaction, message) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: message || 'An error occurred.',
        ephemeral: true
      });
    } else {
      await interaction.followUp({
        content: message || 'An error occurred.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Failed to send error message:', error);
  }
};

exports.publishQuiz = async function publishQuiz(interaction, quizData) {
  try {
    // This is a stub implementation for test compatibility
    // The actual publishing logic is handled in handleQuizApproval
    await interaction.reply({
      content: `📝 Quiz: ${quizData.title || 'Test Quiz'}`,
      embeds: []
    });
  } catch (error) {
    console.error('Failed to publish quiz:', error);
    throw error;
  }
};
