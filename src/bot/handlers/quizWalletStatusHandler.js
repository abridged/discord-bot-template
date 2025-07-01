/**
 * Quiz Wallet Status Handler
 * 
 * Integrates wallet status updates into the quiz creation process
 * Uses event-driven updates with 5-second timeout
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getWalletForDiscordUser } = require('../../services/walletMappingService');
const { setupWalletStatusUpdates } = require('../../utils/walletStatusUpdater');
const crypto = require('crypto');

/**
 * Shows quiz creation UI with wallet status indicator
 * 
 * @param {Object} interaction - Discord interaction object
 * @returns {Promise<Object>} The sent message and metadata for tracking
 */
async function showQuizCreationWithWalletStatus(interaction) {
  // Check initial wallet status
  const userId = interaction.user.id;
  const existingWallet = await getWalletForDiscordUser(userId, false);
  const initialStatus = existingWallet ? 
    `Connected (${existingWallet.substring(0, 6)}...${existingWallet.substring(existingWallet.length - 4)})` : 
    'Connecting...';
  
  // Create quiz creation UI with wallet status
  const embed = new EmbedBuilder()
    .setTitle('Create a Quiz')
    .setDescription('Please provide the quiz details below.')
    .addFields(
      { name: 'Wallet Status', value: initialStatus },
      { name: 'Default Settings', value: '• Reward: 10,000 tokens\n• Distribution: 75% correct / 25% incorrect answers\n• Chain: Base (8453)' }
    )
    .setColor('#5865F2');
    
  // Create unique tracking ID for this interaction
  const trackingId = crypto.randomUUID();
  
  // Add "Continue" button - always enabled even if wallet status is connecting
  // We'll check wallet status again when user proceeds
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`quiz:continue:${trackingId}`)
      .setLabel('Continue to Quiz Creation')
      .setStyle(ButtonStyle.Primary)
  );
  
  // Reply with embed and button
  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
    fetchReply: true
  });
  
  // If wallet isn't connected yet, set up event-based status updates
  if (!existingWallet) {
    // Start wallet status updates with 5 second timeout
    setupWalletStatusUpdates(interaction, userId, response, 5000);
  }
  
  // Return information for other handlers
  return {
    message: response,
    trackingId,
    initialWalletStatus: !!existingWallet
  };
}

/**
 * Checks if wallet is ready before proceeding with quiz creation
 * Should be called when user clicks "Continue" button
 * Uses a 5-second timeout with polling to wait for background wallet lookup to complete
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<{ready: boolean, wallet: string|null, message: string|null}>}
 */
async function checkWalletReadiness(interaction) {
  const userId = interaction.user.id;
  
  // First immediate check
  let wallet = await getWalletForDiscordUser(userId, false);
  
  if (wallet) {
    console.log(`[WalletReadiness] Immediate wallet found for user ${userId}: ${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`);
    return {
      ready: true,
      wallet,
      message: null
    };
  }

  // If no wallet found immediately, wait up to 5 seconds polling every 500ms
  console.log(`[WalletReadiness] No immediate wallet found for user ${userId}, starting 5-second polling...`);
  
  const maxWaitTime = 5000; // 5 seconds
  const pollInterval = 500; // 500ms
  const maxAttempts = Math.floor(maxWaitTime / pollInterval);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait for the poll interval
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    // Check wallet again
    wallet = await getWalletForDiscordUser(userId, false);
    
    if (wallet) {
      console.log(`[WalletReadiness] Wallet found for user ${userId} after ${attempt * pollInterval}ms: ${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`);
      return {
        ready: true,
        wallet,
        message: null
      };
    }
    
    console.log(`[WalletReadiness] Attempt ${attempt}/${maxAttempts}: Still waiting for wallet for user ${userId}...`);
  }

  // Timeout reached without finding wallet
  console.log(`[WalletReadiness] Timeout reached (${maxWaitTime}ms) - wallet not found for user ${userId}`);
  return {
    ready: false,
    wallet: null,
    message: 'Your wallet is not connected yet. Please try again in a few moments.'
  };
}

module.exports = {
  showQuizCreationWithWalletStatus,
  checkWalletReadiness
};
