const { SlashCommandBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const crypto = require('crypto');
const { backgroundWalletLookup } = require('../../services/walletMappingService');

// Constants for quiz creation defaults
const QUIZ_DEFAULTS = {
  FUNDING_AMOUNT: 10000,
  CORRECT_REWARD_PERCENT: 75,
  INCORRECT_REWARD_PERCENT: 25,
  DEFAULT_TOKEN_ADDRESS: process.env.DEFAULT_TOKEN_ADDRESS || '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1', // SEEDS token on Base Sepolia
  DEFAULT_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || '84532' // Base Sepolia
};

// Poll configuration
const POLL_CONFIG = {
  MAX_OPTIONS: 10,
  EMOJI_NUMBERS: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
};

// Text message configuration
const TEXT_CONFIG = {
  MAX_MESSAGE_LENGTH: 1000
};

module.exports = {
  // Command definition using SlashCommandBuilder
  data: new SlashCommandBuilder()
    .setName('mother')
    .setDescription('Multi-purpose bot command with different functionalities')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Choose what action to perform')
        .setRequired(true)
        .addChoices(
          { name: '📊 poll', value: 'poll' },
          { name: '❓ quiz', value: 'quiz' },
          { name: '💬 text', value: 'text' }
        )
    ),
  
  /**
   * Handle modal submissions for poll and text messages only
   * NOTE: Quiz modal submissions are handled directly in interactionCreate.js event handler
   * @param {Object} interaction - Discord modal submission interaction
   * @returns {Promise<void>}
   */
  async modalSubmit(interaction) {
    console.log(`=== MODAL SUBMISSION HANDLER START ===`);
    console.log(`Modal submission received with customId: ${interaction.customId}`);
    console.log('Interaction type:', interaction.type);
    console.log('User:', interaction.user.tag);
    
    try {
      // Handle poll creation modal submissions
      if (interaction.customId.startsWith('poll-creation-')) {
        await this.handlePollModalSubmission(interaction);
        return;
      }
      
      // Handle text message modal submissions
      if (interaction.customId.startsWith('text-message-')) {
        await this.handleTextModalSubmission(interaction);
        return;
      }
      
      console.warn(`Unhandled modal submission: ${interaction.customId}`);
    } catch (error) {
      console.error('Error in modal submission handler:', error);
      await this.sendErrorResponse(interaction, 'There was an error processing your submission. Please try again later.');
    }
  },

  /**
   * Handle poll creation modal submission
   * @param {Object} interaction - Discord modal submission interaction
   * @returns {Promise<void>}
   * @private
   */
  async handlePollModalSubmission(interaction) {
    const question = interaction.fields.getTextInputValue('pollQuestion');
    const optionsInput = interaction.fields.getTextInputValue('pollOptions');
    
    // Split options by newline and filter out empty lines
    const options = optionsInput
      .split('\n')
      .map(option => option.trim())
      .filter(option => option.length > 0);
    
    // Validate that we have at least 2 options
    if (options.length < 2) {
      await interaction.reply({
        content: 'Please provide at least 2 options for your poll.',
        ephemeral: true
      });
      return;
    }
    
    // Create embed for the poll
    const pollEmbed = new EmbedBuilder()
      .setColor('#FF9800')
      .setTitle('📊 ' + question)
      .setDescription('React with the corresponding emoji to vote!')
      .setFooter({ text: `Poll created by ${interaction.user.username}` })
      .setTimestamp();
    
    // Format options with emoji numbers (limit to available emojis)
    const availableOptions = options.slice(0, POLL_CONFIG.MAX_OPTIONS);
    const optionsText = availableOptions
      .map((option, index) => `${POLL_CONFIG.EMOJI_NUMBERS[index]} ${option}`)
      .join('\n\n');
    
    pollEmbed.addFields({ name: 'Options', value: optionsText });
    
    // Send the poll
    const reply = await interaction.reply({
      embeds: [pollEmbed],
      fetchReply: true
    });
    
    // Add reactions for voting
    for (let i = 0; i < availableOptions.length; i++) {
      try {
        await reply.react(POLL_CONFIG.EMOJI_NUMBERS[i]);
      } catch (error) {
        console.error(`Failed to add reaction ${POLL_CONFIG.EMOJI_NUMBERS[i]}:`, error);
      }
    }
  },

  /**
   * Handle text message modal submission
   * @param {Object} interaction - Discord modal submission interaction
   * @returns {Promise<void>}
   * @private
   */
  async handleTextModalSubmission(interaction) {
    const messageContent = interaction.fields.getTextInputValue('messageContent');
    
    // Create embedded message
    const messageEmbed = new EmbedBuilder()
      .setColor('#2196F3')
      .setDescription(messageContent)
      .setFooter({ text: `Message from ${interaction.user.username}` })
      .setTimestamp();
    
    // Send the message
    await interaction.reply({
      embeds: [messageEmbed]
    });
  },
  
  /**
   * Command execution handler
   * @param {Object} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      const action = interaction.options.getString('action');
      console.log(`/mother command executed with action: ${action} by user: ${interaction.user.tag}`);

      // Trigger background wallet lookup for user
      backgroundWalletLookup(interaction.user.id).catch(error => {
        console.error('Background wallet lookup failed:', error);
      });

      // Route to appropriate handler based on action
      switch (action) {
        case 'poll':
          await this.handlePollCommand(interaction);
          break;
        case 'quiz':
          await this.handleQuizCommand(interaction);
          break;
        case 'text':
          await this.handleTextCommand(interaction);
          break;
        default:
          await interaction.reply({
            content: `Unknown action: ${action}`,
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Error in /mother command execution:', error);
      await this.sendErrorResponse(interaction, 'There was an error executing the command. Please try again later.');
    }
  },

  /**
   * Handle button interactions for poll-related buttons
   * @param {Object} interaction - Discord button interaction
   * @returns {Promise<void>}
   */
  async buttonInteraction(interaction) {
    console.log(`Button interaction: ${interaction.customId}`);
    
    try {
      if (interaction.customId.startsWith('poll-')) {
        // Poll button handling logic would go here
        await interaction.reply({
          content: 'Poll button functionality not yet implemented.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error in button interaction handler:', error);
      await this.sendErrorResponse(interaction, 'There was an error processing the button interaction.');
    }
  },

  /**
   * Handler for the poll subcommand
   * @param {Object} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async handlePollCommand(interaction) {
    try {
      // Create a modal for poll creation
      const modal = new ModalBuilder()
        .setCustomId(`poll-creation-${interaction.user.id}`)
        .setTitle('Create a Poll');

      // Add poll question input
      const questionInput = new TextInputBuilder()
        .setCustomId('pollQuestion')
        .setLabel('Poll Question')
        .setPlaceholder('What question would you like to ask?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200);
        
      // Add poll options input
      const optionsInput = new TextInputBuilder()
        .setCustomId('pollOptions')
        .setLabel('Poll Options (one per line)')
        .setPlaceholder('Option 1\nOption 2\nOption 3\n...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500);
        
      // Create action rows to hold the inputs
      const questionRow = new ActionRowBuilder().addComponents(questionInput);
      const optionsRow = new ActionRowBuilder().addComponents(optionsInput);
      
      // Add the action rows to the modal
      modal.addComponents(questionRow, optionsRow);
      
      // Show the modal
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in poll command handler:', error);
      await this.sendErrorResponse(interaction, 'There was an error creating the poll modal.');
    }
  },

  /**
   * Handler for the quiz subcommand
   * Creates and displays the quiz creation modal with pre-filled defaults
   * @param {Object} interaction - Discord slash command interaction
   * @returns {Promise<boolean>} Success status
   */
  async handleQuizCommand(interaction) {
    try {
      console.log('Creating quiz modal for user:', interaction.user.tag);
      
      // Create a modal for quiz creation
      const modal = new ModalBuilder()
        .setCustomId(`quiz-creation-${generateUniqueId()}`)
        .setTitle('Create Quiz with MotherFactory');

      // URL input for quiz content
      const urlInput = new TextInputBuilder()
        .setCustomId('url')
        .setLabel('Content URL (required)')
        .setPlaceholder('Enter URL to article, video, or content for the quiz')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(500);
        
      // Token address input with default value
      const tokenAddressInput = new TextInputBuilder()
        .setCustomId('tokenAddress')
        .setLabel('Token Address (required)')
        .setPlaceholder('Enter the ERC20 token contract address')
        .setValue(QUIZ_DEFAULTS.DEFAULT_TOKEN_ADDRESS)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(42);
        
      // Chain ID input with default value
      const chainIdInput = new TextInputBuilder()
        .setCustomId('chainId')
        .setLabel('Chain ID (default is Base Sepolia)')
        .setPlaceholder('Enter chain ID')
        .setValue(QUIZ_DEFAULTS.DEFAULT_CHAIN_ID)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
        
      // Funding amount input with default value
      const fundingAmountInput = new TextInputBuilder()
        .setCustomId('fundingAmount')
        .setLabel('Funding Amount (integer only)')
        .setPlaceholder('Enter funding amount in tokens')
        .setValue(QUIZ_DEFAULTS.FUNDING_AMOUNT.toString())
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
        
      // Consolidated reward field (format: "correct,incorrect")
      const rewardsInput = new TextInputBuilder()
        .setCustomId('rewards')
        .setLabel('Rewards (correct%,incorrect%)')
        .setPlaceholder('Example: 75,25 (must sum to 100)')
        .setValue(`${QUIZ_DEFAULTS.CORRECT_REWARD_PERCENT},${QUIZ_DEFAULTS.INCORRECT_REWARD_PERCENT}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      // Create action rows to hold the inputs (maximum of 5 allowed by Discord)
      const urlRow = new ActionRowBuilder().addComponents(urlInput);
      const tokenAddressRow = new ActionRowBuilder().addComponents(tokenAddressInput);
      const chainIdRow = new ActionRowBuilder().addComponents(chainIdInput);
      const fundingAmountRow = new ActionRowBuilder().addComponents(fundingAmountInput);
      const rewardsRow = new ActionRowBuilder().addComponents(rewardsInput);

      // Add the action rows to the modal
      modal.addComponents(urlRow, tokenAddressRow, chainIdRow, fundingAmountRow, rewardsRow);
      
      // Show the modal directly to avoid timeout
      await interaction.showModal(modal);
      return true;
    } catch (error) {
      console.error('Error in quiz command handler:', error);
      await this.sendErrorResponse(interaction, 'There was an error creating the quiz. Please try again later.');
      return false;
    }
  },
  
  /**
   * Handler for the text subcommand
   * @param {Object} interaction - Discord slash command interaction
   * @returns {Promise<boolean>} Success status
   */
  async handleTextCommand(interaction) {
    try {
      // Create a modal for text message
      const modal = new ModalBuilder()
        .setCustomId(`text-message-${interaction.user.id}`)
        .setTitle('Send a Message');

      // Add message input field
      const messageInput = new TextInputBuilder()
        .setCustomId('messageContent')
        .setLabel('What would you like to say?')
        .setPlaceholder('Type your message here...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(TEXT_CONFIG.MAX_MESSAGE_LENGTH);
        
      // Create action row to hold the input
      const actionRow = new ActionRowBuilder().addComponents(messageInput);
      
      // Add the action row to the modal
      modal.addComponents(actionRow);
      
      // Show the modal immediately
      await interaction.showModal(modal);
      return true;
    } catch (error) {
      console.error('Error showing text modal:', error);
      await this.sendErrorResponse(interaction, 'There was an error creating the text message modal.');
      return false;
    }
  },

  /**
   * Send standardized error response to user
   * @param {Object} interaction - Discord interaction
   * @param {string} message - Error message to display
   * @returns {Promise<void>}
   * @private
   */
  async sendErrorResponse(interaction, message) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: message,
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: message,
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          content: message,
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
};

/**
 * Generate a unique ID for modals and other components
 * @returns {string} Unique hexadecimal ID
 */
function generateUniqueId() {
  return crypto.randomBytes(8).toString('hex');
}
