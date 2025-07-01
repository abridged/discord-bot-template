/**
 * Wallet Status Updater Utility
 * 
 * Provides functions to update wallet status in Discord UI elements
 * using the walletEvents emitter from walletMappingService
 */

const { EmbedBuilder } = require('discord.js');
const { walletEvents, getWalletForDiscordUser } = require('../services/walletMappingService');

/**
 * Sets up wallet status updates for a Discord message
 * This function will listen for wallet update events and update the wallet status field in the message
 * 
 * @param {Object} interaction - Discord interaction object
 * @param {string} userId - Discord user ID
 * @param {Object} message - Discord message object (fetched)
 * @param {number} timeout - Timeout in milliseconds (default: 5000ms)
 * @returns {Promise<void>}
 */
async function setupWalletStatusUpdates(interaction, userId, message, timeout = 5000) {
  try {
    // First check if wallet already exists
    const existingWallet = await getWalletForDiscordUser(userId, false);
    if (existingWallet) {
      // Wallet already exists, update the UI immediately
      await updateWalletStatusInUI(message, existingWallet);
      return;
    }
    
    // Create a promise that will resolve when wallet is updated or timeout
    const walletPromise = new Promise((resolve) => {
      // Listen for wallet update events for this user
      const walletListener = (data) => {
        if (data.discordId === userId) {
          // Wallet updated for this user
          resolve({ wallet: data.walletAddress });
          // Remove the listener
          walletEvents.removeListener('wallet-updated', walletListener);
        }
      };
      
      // Add the event listener
      walletEvents.on('wallet-updated', walletListener);
      
      // Set a timeout to clean up
      setTimeout(() => {
        walletEvents.removeListener('wallet-updated', walletListener);
        resolve({ timeout: true });
      }, timeout);
    });
    
    // Wait for wallet update or timeout
    const result = await walletPromise;
    
    if (result.wallet) {
      // Wallet was found, update the UI
      await updateWalletStatusInUI(message, result.wallet);
    } else if (result.timeout) {
      // Timeout, update UI with timeout message
      await updateWalletStatusInUI(message, null, true);
    }
  } catch (error) {
    console.error('Error in setupWalletStatusUpdates:', error);
  }
}

/**
 * Updates the wallet status in a Discord message
 * 
 * @param {Object} message - Discord message object
 * @param {string|null} wallet - Wallet address or null if not found
 * @param {boolean} isTimeout - Whether this is a timeout update
 * @returns {Promise<void>}
 */
async function updateWalletStatusInUI(message, wallet, isTimeout = false) {
  try {
    // Get the current embed
    if (!message || !message.embeds || message.embeds.length === 0) {
      console.log('No embeds found in message');
      return;
    }
    
    const embedData = message.embeds[0].toJSON();
    
    // Find the wallet status field
    const walletStatusField = embedData.fields?.find(f => f.name === 'Wallet Status');
    if (!walletStatusField) {
      console.log('No wallet status field found in embed');
      return;
    }
    
    // Update the field value
    if (wallet) {
      // Truncate wallet address for display
      const shortWallet = `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`;
      walletStatusField.value = `Connected (${shortWallet})`;
    } else if (isTimeout) {
      walletStatusField.value = 'Not connected yet. Please try again in a few moments.';
    } else {
      walletStatusField.value = 'Connecting...';
    }
    
    // Create updated embed
    const updatedEmbed = EmbedBuilder.from(embedData);
    
    // Update the message
    await message.edit({ embeds: [updatedEmbed] });
    
  } catch (error) {
    console.error('Error updating wallet status in UI:', error);
  }
}

module.exports = {
  setupWalletStatusUpdates
};
