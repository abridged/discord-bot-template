/**
 * Ask Command
 * 
 * Handles the /ask slash command for creating token-incentivized quizzes from URLs
 */

const { SlashCommandBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { processQuizCommand } = require('../../orchestration');

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
    
    // Process command via orchestration module
    const result = await processQuizCommand({
      url,
      token,
      chain,
      amount,
      userId: interaction.user?.id || 'test_user_id'
    });
    
    // Handle error response
    if (!result.success) {
      return await sendError(interaction, `Error creating quiz: ${result.error}`);
    }
    
    // Success - send ephemeral preview with approval/cancel buttons
    await sendEphemeralPreview(interaction, result.quiz);
    
  } catch (error) {
    await sendError(interaction, `Error creating quiz: ${error.message}`);
  }
}

/**
 * Send ephemeral preview with approval/cancel buttons
 * @param {Object} interaction - Discord interaction
 * @param {Object} quizData - Generated quiz data
 */
async function sendEphemeralPreview(interaction, quizData) {
  // Create unique ID for this quiz preview
  const previewId = `quiz_${Date.now()}_${interaction.user.id}`;
  
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
          .setCustomId(`approve_${previewId}`)
          .setLabel('Create Quiz')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_${previewId}`)
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
  try {
    // Extract user ID from interaction for security verification
    const interactionUserId = interaction.user?.id;
    const buttonIdParts = interaction.customId?.split('_') || [];
    
    // Security check: verify the user who clicked matches the user in the custom ID
    // This prevents user impersonation attacks
    if (buttonIdParts.length >= 3 && buttonIdParts[2] !== interactionUserId) {
      throw new Error('Unauthorized: You cannot approve a quiz created by someone else');
    }
    
    // Update interaction to show processing state
    await interaction.update({
      content: 'Creating quiz contract... Please wait.',
      components: [],
      embeds: []
    });
    
    // Generate quiz ID
    const quizId = `quiz_${Date.now()}`;
    
    // Create quiz escrow contract
    // This is where the contract deployment happens and could fail
    let contractAddress;
    try {
      // In a real implementation, this would create the actual contract
      // For now we use a mock address, but we need to catch potential contract errors
      contractAddress = '0xMockContractAddress';
      
      // Mock implementation to simulate contract creation
      // The createQuizEscrow function could be imported from contracts/quizEscrow.js
      // contractAddress = await createQuizEscrow({
      //   quizId,
      //   questions: quizData.questions,
      //   tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
      //   chainId: 8453,
      //   amount: 10000
      // });
    } catch (contractError) {
      // Specific handling for contract deployment errors
      console.error('Contract deployment failed:', contractError);
      throw new Error(`Contract deployment failed: ${contractError.message}`);
    }
    
    // Update interaction to show success after contract is created
    await interaction.update({
      content: 'Quiz created successfully!',
      components: [],
      embeds: []
    });
    
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
      // Instead, inform the user about partial success
      await interaction.followUp({
        content: `Quiz contract created but failed to publish: ${publishError.message}`,
        ephemeral: true
      });
    }
  } catch (error) {
    // Handle any uncaught errors during the entire process
    console.error('Error in quiz approval flow:', error);
    
    try {
      // Handle Discord interaction token expiration
      if (error.code === 40060) { // INTERACTION_TIMEOUT
        // Cannot respond to an expired interaction
        console.error('Interaction token expired, cannot respond');
        return;
      }
      
      // Update the interaction with error information
      await interaction.update({
        content: `Error creating quiz: ${error.message}`,
        components: [],
        embeds: []
      });
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
  
  // Create question embeds
  const questionEmbeds = quizData.questions.map((q, i) => {
    const optionsText = q.options.map((opt, j) => `${['A', 'B', 'C', 'D'][j]}) ${opt}`).join('\n');
    
    return new EmbedBuilder()
      .setTitle(`Question ${i+1}`)
      .setDescription(q.question)
      .addFields({ name: 'Options', value: optionsText })
      .setColor(0x00CCFF);
  });
  
  // Send quiz to channel
  await channel.send({
    content: 'New Quiz Available! Answer all questions for a chance to earn tokens.',
    embeds: [embed, ...questionEmbeds]
  });
  
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

module.exports = {
  askCommand,
  handleAskCommand,
  sendEphemeralPreview,
  handleQuizApproval,
  handleQuizCancellation,
  publishQuiz,
  sendError
};
