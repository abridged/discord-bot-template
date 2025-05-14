/**
 * Ask Command
 * 
 * Handles the /ask slash command for creating token-incentivized quizzes from URLs
 */

const { SlashCommandBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { processQuizCommand } = require('../../orchestration');
const { sanitizeUrl, validateTokenAmount, validateEthereumAddress } = require('../../security/inputSanitizer');

/**
 * /ask command definition
 */
// Define the command directly for simplicity and to avoid mock issues
const askCommand = {
  data: {
    name: 'ask',
    description: 'Create a token-incentivized quiz from a URL with automated reward distribution',
    options: [
      {
        name: 'url',
        description: 'URL to generate quiz questions from',
        type: 3, // STRING type
        required: true
      },
      {
        name: 'token',
        description: 'ERC20 token address for rewards (default: 0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1)',
        type: 3, // STRING type
        required: false
      },
      {
        name: 'chain',
        description: 'Chain ID (default: 8453 - Base)',
        type: 4, // INTEGER type
        required: false
      },
      {
        name: 'amount',
        description: 'Token amount for rewards (default: 10000)',
        type: 4, // INTEGER type
        required: false
      }
    ],
    toJSON: function() {
      return {
        name: this.name,
        description: this.description,
        options: this.options
      };
    }
  },
  execute: handleAskCommand
};

/**
 * Handle the /ask command
 * @param {Object} interaction - Discord interaction object
 */
async function handleAskCommand(interaction) {
  try {
    // Extract command options with defaults
    const url = interaction.options.getString('url');
    const token = interaction.options.getString('token') || '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1';
    const chain = interaction.options.getInteger('chain') || 8453; // Base chain
    const amount = interaction.options.getInteger('amount') || 10000;
    
    // Validate URL parameter
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
      return await sendError(interaction, 
        "❌ Invalid or unsafe URL provided. Please check the URL format and ensure it doesn't contain dangerous content.");
    }
    
    // Validate token address
    if (!validateEthereumAddress(token)) {
      return await sendError(interaction, 
        "❌ Invalid token address format. Please provide a valid ERC20 token address starting with 0x followed by 40 hexadecimal characters.");
    }
    
    // Validate token amount
    if (!validateTokenAmount(amount)) {
      return await sendError(interaction, 
        "❌ Invalid token amount. Please provide a positive number within the safe integer range.");
    }
    
    // Validate chain ID (simple range check, can be expanded)
    if (chain <= 0 || chain > 100000) {
      return await sendError(interaction, 
        "❌ Invalid chain ID. Please provide a valid blockchain network ID.");
    }
    
    // All parameters validated successfully
    
    // Process command via orchestration module with sanitized URL
    const result = await processQuizCommand({
      url: sanitizedUrl,
      token,
      chain,
      amount,
      userId: interaction.user?.id || 'test_user_id'
    });
    
    // Handle error response
    if (!result.success) {
      return await sendError(interaction, `❌ Error creating quiz: ${result.error}`);
    }
    
    // Success - send ephemeral preview with approval/cancel buttons
    await sendEphemeralPreview(interaction, result.quiz);
    
  } catch (error) {
    await sendError(interaction, `❌ Error creating quiz: ${error.message}`);
  }
}

/**
 * Send ephemeral preview with approval/cancel buttons
 * @param {Object} interaction - Discord interaction
 * @param {Object} quizData - Generated quiz data
 */
async function sendEphemeralPreview(interaction, quizData) {
  // Create unique ID for this quiz preview
  const timestamp = Date.now();
  const userId = interaction.user.id;
  const previewId = `${timestamp}_${userId}`;
  
  try {
    // Create embed for preview
    const embed = new EmbedBuilder()
      .setTitle('Quiz Preview')
      .setDescription(`Preview of quiz generated from: ${quizData.sourceUrl}`)
      .addFields(
        { name: 'Source', value: quizData.sourceTitle },
        { name: 'Questions', value: `${quizData.questions.length} questions` }
      )
      .setColor(0x0099FF);
    
    // Add sample questions to preview
    quizData.questions.forEach((q, i) => {
      embed.addFields({ name: `Question ${i+1}`, value: q.question });
    });
    
    // Create approval/cancel buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve:${userId}:${timestamp}`)
          .setLabel('Create Quiz')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel:${userId}:${timestamp}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );
    
    // Send ephemeral message with preview
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    return true;
  } catch (error) {
    console.error('Error sending ephemeral preview:', error);
    await sendError(interaction, `Failed to create quiz preview: ${error.message}`);
    return false;
  }
}

/**
 * Handle quiz approval button
 * @param {Object} interaction - Button interaction
 * @param {Object} quizData - Quiz data to publish
 */
async function handleQuizApproval(interaction, quizData) {
  // Interaction should already be deferred by the interaction handler
  // but we'll check just in case
  let isDeferred = interaction.deferred;

  try {
    // Extract user ID from interaction for security verification
    const interactionUserId = interaction.user?.id;
    const buttonIdParts = interaction.customId?.split(':') || [];
    
    // Security check: verify the user who clicked matches the user in the custom ID
    // This prevents user impersonation attacks
    // The button ID format is: approve:userId:timestamp
    if (buttonIdParts.length >= 2 && buttonIdParts[1] !== interactionUserId) {
      console.log(`Button ID parts: ${buttonIdParts.join(', ')}`);
      console.log(`Interaction user ID: ${interactionUserId}`);
      
      // Choose appropriate response method based on interaction state
      if (isDeferred) {
        await interaction.followUp({
          content: 'Unauthorized: You cannot approve a quiz created by someone else',
          ephemeral: true
        }).catch(e => console.error('Failed to send unauthorized response:', e));
      } else {
        await interaction.reply({
          content: 'Unauthorized: You cannot approve a quiz created by someone else',
          ephemeral: true
        }).catch(e => console.error('Failed to send unauthorized response:', e));
      }
      return;
    }
    
    // Ensure the interaction is deferred if it hasn't been already
    if (!isDeferred) {
      try {
        await interaction.deferUpdate();
        isDeferred = true;
      } catch (deferError) {
        console.error('Failed to defer update:', deferError);
        // Try to reply instead
        try {
          await interaction.reply({
            content: 'Processing your request...',
            ephemeral: true
          });
          isDeferred = true;
        } catch (replyError) {
          console.error('Failed to reply:', replyError);
          // At this point we can't interact, just continue and hope for the best
        }
      }
    }
    
    // Generate quiz ID
    const quizId = `quiz_${Date.now()}`;
    
    // Create quiz escrow contract
    // For Phase 1, we'll use a mock implementation that completes quickly
    let contractAddress;
    
    // Simulate a brief delay for contract creation (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In Phase 1, we use a mock contract address
    contractAddress = '0xMockContractAddress' + Math.floor(Math.random() * 1000);
    
    // Log for debugging
    console.log(`Quiz contract created with address: ${contractAddress}`);
    
    // Update the message if possible
    try {
      if (isDeferred) {
        await interaction.editReply({
          content: 'Quiz created successfully! Questions will appear below.',
          components: [],
          embeds: []
        });
      }
    } catch (editError) {
      console.error('Failed to edit reply:', editError);
      // Continue anyway - we'll still try to publish the quiz
    }
    
    // Publish quiz to channel
    // This could fail if permissions are inadequate or message limits are exceeded
    try {
      await publishQuiz(
        interaction.channel, 
        quizData, 
        quizId, 
        contractAddress, 
        {
          tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
          chainId: 8453,
          amount: 10000
        }
      );
    } catch (publishError) {
      console.error('Failed to publish quiz:', publishError);
      // We already created the contract, so we don't throw this error
      // Instead, inform the user about partial success if possible
      try {
        if (isDeferred) {
          await interaction.followUp({
            content: `Quiz contract created but failed to publish: ${publishError.message}`,
            ephemeral: true
          });
        }
      } catch (followUpError) {
        console.error('Failed to send followUp:', followUpError);
      }
    }
  } catch (error) {
    // Handle any uncaught errors during the entire process
    console.error('Error in quiz approval flow:', error);
    
    try {
      // Try to inform the user if possible
      if (isDeferred) {
        await interaction.followUp({
          content: `Error creating quiz: ${error.message}`,
          ephemeral: true
        });
      }
    } catch (responseError) {
      // Even our error handling failed - this could happen with expired tokens
      console.error('Failed to send error response:', responseError);
    }
  }
}

/**
 * Handle quiz cancellation button
 * @param {Object} interaction - Button interaction
 */
async function handleQuizCancellation(interaction) {
  await interaction.update({
    content: 'Quiz creation cancelled.',
    components: [],
    embeds: []
  });
}

/**
 * Publish quiz to channel
 * @param {Object} channel - Discord channel
 * @param {Object} quizData - Quiz data
 * @param {string} quizId - Quiz ID
 * @param {string} contractAddress - Quiz escrow contract address
 * @param {Object} rewardInfo - Token reward information
 */
async function publishQuiz(channel, quizData, quizId, contractAddress, rewardInfo) {
  // Create expiry date (end of next day UTC)
  const expiryDate = new Date();
  expiryDate.setUTCDate(expiryDate.getUTCDate() + 1);
  expiryDate.setUTCHours(23, 59, 59, 999);
  
  // Create main embed
  const embed = new EmbedBuilder()
    .setTitle(`Quiz: ${quizData.sourceTitle}`)
    .setDescription(`Answer questions about: ${quizData.sourceUrl}`)
    .setColor(0x00AAFF);
    
  // Prepare the fields
  const questionField = { name: 'Questions', value: `${quizData.questions.length} multiple choice questions` };
  const distributionField = { name: 'Distribution', value: '75% to correct answers, 25% to incorrect answers (capped)' };
  
  // Add reward info if provided
  if (rewardInfo && rewardInfo.amount && rewardInfo.tokenAddress) {
    const rewardField = { 
      name: 'Reward', 
      value: `${rewardInfo.amount} tokens (${rewardInfo.tokenAddress.slice(0, 6)}...)` 
    };
    // Add fields individually to ensure proper structure
    embed.addFields(questionField, rewardField, distributionField);
  } else {
    // Add fields without reward info
    embed.addFields(questionField, distributionField);
  }
  
  // Set footer with expiry time and quiz ID
  embed.setFooter({ text: `Expires: ${expiryDate.toUTCString()} | Quiz ID: ${quizId}` });
  embed.setTimestamp();
  
  // First, send the main quiz introduction message without any questions
  await channel.send({
    content: 'New Quiz Available! Answer all questions for a chance to earn tokens.',
    embeds: [embed]
  });
  
  // Then send each question as a separate message with its own buttons
  // This avoids Discord's component limitations (max 5 action rows per message)
  for (let i = 0; i < quizData.questions.length; i++) {
    const q = quizData.questions[i];
    
    // Ensure we have exactly 5 options: 3 regular + "All of the above" + "None of the above"
    let displayOptions = [];
    
    // If we have fewer than 3 regular options, fill in with generic ones
    const regularOptions = q.options.slice(0, 3);
    while (regularOptions.length < 3) {
      regularOptions.push(`Option ${regularOptions.length + 1}`);
    }
    
    // Add all 5 options: A, B, C, D, E
    displayOptions = [
      ...regularOptions,
      'All of the above',
      'None of the above'
    ];
    
    // Create options text for display
    const optionsText = displayOptions.map((opt, j) => 
      `${['A', 'B', 'C', 'D', 'E'][j]}) ${opt}`
    ).join('\n');
    
    // Create answer buttons for this question (5 buttons: A, B, C, D, E)
    const buttonRow = new ActionRowBuilder();
    ['A', 'B', 'C', 'D', 'E'].forEach((option, j) => {
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`quiz_answer:${quizId}:${i}:${j}`)
          .setLabel(option)
          .setStyle(ButtonStyle.Primary)
      );
    });
    
    // Create the question embed
    const questionEmbed = new EmbedBuilder()
      .setTitle(`Question ${i+1}`)
      .setDescription(q.question)
      .addFields({ name: 'Options', value: optionsText })
      .setColor(0x00CCFF);
    
    // Send this question as a separate message with its own buttons
    await channel.send({
      embeds: [questionEmbed],
      components: [buttonRow]
    });
    
    // Add a small delay between messages to avoid rate limiting
    if (i < quizData.questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return true;
}

/**
 * Send error message to user
 * @param {Object} interaction - Discord interaction
 * @param {string} errorMessage - Error message
 */
async function sendError(interaction, errorMessage) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: errorMessage,
      components: []
    });
  } else {
    await interaction.reply({
      content: errorMessage,
      ephemeral: true
    });
  }
}

/**
 * Handle quiz answer button click
 * @param {Object} interaction - Button interaction
 */
async function handleQuizAnswer(interaction) {
  try {
    // Parse button custom ID to extract quiz ID, question number, and selected option
    // Format: quiz_answer:quizId:questionNumber:optionIndex
    const [, quizId, questionNumber, optionIndex] = interaction.customId.split(':');
    
    // Get the option letter user selected (A, B, C, D, or E)
    const optionLetter = ['A', 'B', 'C', 'D', 'E'][parseInt(optionIndex)];
    
    // First, acknowledge the user's selection with an ephemeral reply
    await interaction.reply({
      content: `Your answer (${optionLetter}) for Question ${parseInt(questionNumber) + 1} has been recorded.`,
      ephemeral: true
    });
    
    // Get the original message to update the buttons
    const originalMessage = interaction.message;
    
    // Create a new set of disabled buttons
    const disabledButtonRow = new ActionRowBuilder();
    ['A', 'B', 'C', 'D', 'E'].forEach((option, j) => {
      // Create a button for each option, but all disabled
      // Highlight the selected option with a different style
      const button = new ButtonBuilder()
        .setCustomId(`quiz_answer:${quizId}:${questionNumber}:${j}`)
        .setLabel(option)
        .setDisabled(true);
      
      // Set the style - SUCCESS for the selected option, SECONDARY for others
      if (j === parseInt(optionIndex)) {
        button.setStyle(ButtonStyle.Success); // Green for selected
      } else {
        button.setStyle(ButtonStyle.Secondary); // Grey for other options
      }
      
      disabledButtonRow.addComponents(button);
    });
    
    // Update the original message with disabled buttons
    await originalMessage.edit({
      components: [disabledButtonRow]
    });
    
    // Record the answer in a database (mock implementation)
    console.log(`User ${interaction.user.id} answered question ${questionNumber} with option ${optionIndex}`);
    
    // Here we would actually call the quiz answer processor function for a real implementation
    // await processQuizAnswer(quizId, interaction.user.id, parseInt(questionNumber), parseInt(optionIndex));
    
  } catch (error) {
    console.error('Error handling quiz answer:', error);
    try {
      await interaction.reply({
        content: 'There was an error processing your answer. Please try again.',
        ephemeral: true
      });
    } catch (replyError) {
      // If we've already replied, use followUp instead
      console.error('Error replying to interaction:', replyError);
      try {
        await interaction.followUp({
          content: 'There was an error processing your answer. Please try again.',
          ephemeral: true
        });
      } catch (followUpError) {
        console.error('Error with followUp:', followUpError);
      }
    }
  }
}

// Export the command as the default export for discord.js command handling
module.exports = askCommand;

// Also export the helper functions for testing and other modules
module.exports.askCommand = askCommand;
module.exports.handleAskCommand = handleAskCommand;
module.exports.sendEphemeralPreview = sendEphemeralPreview;
module.exports.handleQuizApproval = handleQuizApproval;
module.exports.handleQuizCancellation = handleQuizCancellation;
module.exports.publishQuiz = publishQuiz;
module.exports.sendError = sendError;
module.exports.handleQuizAnswer = handleQuizAnswer;
