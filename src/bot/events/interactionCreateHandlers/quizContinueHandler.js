/**
 * Quiz Continue Button Handler
 * 
 * Handles the "Continue to Quiz Creation" button click, checking wallet readiness
 * before proceeding with quiz creation
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { checkWalletReadiness } = require('../../handlers/quizWalletStatusHandler');

/**
 * Handle the quiz continue button click
 * 
 * @param {Object} interaction - Discord button interaction
 * @param {string} trackingId - Tracking ID from the button's custom ID
 * @returns {Promise<void>}
 */
async function handleQuizContinueButton(interaction, trackingId) {
  try {
    // First check if wallet is ready
    const walletStatus = await checkWalletReadiness(interaction);
    
    if (!walletStatus.ready) {
      // Wallet not ready - show error message
      await interaction.reply({
        content: walletStatus.message || 'Your wallet is not connected yet. Please try again in a few moments.',
        ephemeral: true
      });
      return;
    }
    
    // Wallet is ready - proceed with quiz creation modal
    console.log(`Wallet ready for user ${interaction.user.id}, showing quiz creation modal`);
    
    // Default values matching /ask command
    const defaultFunding = 10000;
    const defaultRewards = '75,25';
    
    // Create the quiz modal
    const modal = new ModalBuilder()
      .setCustomId(`quiz-creation-${interaction.user.id}`)
      .setTitle('Create a Quiz');
      
    // Add URL input
    const urlInput = new TextInputBuilder()
      .setCustomId('url')
      .setLabel('URL for Quiz Content')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/article')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);
      
    // Add funding input with default
    const fundingInput = new TextInputBuilder()
      .setCustomId('funding')
      .setLabel('Funding Amount (tokens)')
      .setStyle(TextInputStyle.Short)
      .setValue(defaultFunding.toString())
      .setPlaceholder('e.g., 10000')
      .setRequired(true);
      
    // Add rewards distribution input
    const rewardsInput = new TextInputBuilder()
      .setCustomId('rewards')
      .setLabel('Rewards Distribution (% correct, % incorrect)')
      .setStyle(TextInputStyle.Short)
      .setValue(defaultRewards)
      .setPlaceholder('e.g., 75,25')
      .setRequired(true);
      
    // Build action rows for each input (modal requires one action row per input)
    const urlRow = new ActionRowBuilder().addComponents(urlInput);
    const fundingRow = new ActionRowBuilder().addComponents(fundingInput);
    const rewardsRow = new ActionRowBuilder().addComponents(rewardsInput);
    
    // Add inputs to modal
    modal.addComponents(urlRow, fundingRow, rewardsRow);
    
    // Show the modal
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('Error handling quiz continue button:', error);
    
    try {
      await interaction.reply({
        content: 'There was an error processing your request. Please try again later.',
        ephemeral: true
      });
    } catch (replyError) {
      console.error('Error sending error response:', replyError);
      // Try to follow up if reply fails
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.followUp({
            content: 'There was an error processing your request. Please try again later.',
            ephemeral: true
          });
        } catch (followUpError) {
          console.error('Failed to send follow-up error message:', followUpError);
        }
      }
    }
  }
}

module.exports = handleQuizContinueButton;
