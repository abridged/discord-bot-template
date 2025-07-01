/**
 * Wallet Mapping Service
 * 
 * Provides methods for managing the cache of Discord user ID to wallet address mappings.
 * The service handles background lookups, cache updates, and minimizes Account Kit SDK calls.
 */

const { getUserWallet } = require('../account-kit/sdk');
const { sequelize, WalletMapping } = require('../database');
const { Op } = require('sequelize');
const EventEmitter = require('events');

// Create wallet event emitter
const walletEvents = new EventEmitter();

// Cache expiration settings
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours default cache time-to-live

/**
 * Gets a wallet address for a Discord user, first checking cache then Account Kit SDK
 * 
 * @param {string} discordId - Discord user ID
 * @param {boolean} forceRefresh - If true, bypass cache and force call to Account Kit SDK
 * @returns {Promise<string|null>} Wallet address or null if not found
 */
async function getWalletForDiscordUser(discordId, forceRefresh = false) {
  try {
    // Step 1: Check cache if not forcing refresh
    if (!forceRefresh) {
      const cachedMapping = await WalletMapping.findOne({
        where: {
          discordId,
          // Only use cache entries updated within the TTL
          lastUpdated: {
            [Op.gt]: new Date(Date.now() - CACHE_TTL_MS)
          }
        }
      });
      
      if (cachedMapping) {
        console.log(`[WalletMapping] Cache HIT for Discord user ${discordId}: ${cachedMapping.walletAddress}`);
        return cachedMapping.walletAddress;
      }
      
      console.log(`[WalletMapping] Cache MISS for Discord user ${discordId}`);
    }
    
    // Step 2: Call Account Kit SDK
    console.log(`[WalletMapping] Calling Account Kit SDK for Discord user ${discordId}`);
    const walletAddress = await getUserWallet(discordId);
    
    if (walletAddress) {
      // Step 3: Update cache with new wallet address
      await updateWalletMapping(discordId, walletAddress);
      return walletAddress;
    }
    
    console.log(`[WalletMapping] No wallet found for Discord user ${discordId}`);
    return null;
  } catch (error) {
    console.error(`[WalletMapping] Error getting wallet for Discord user ${discordId}:`, error);
    return null;
  }
}

/**
 * Updates or creates a wallet mapping in the database
 * 
 * @param {string} discordId - Discord user ID
 * @param {string} walletAddress - Wallet address
 * @param {string} platform - Platform (default: 'discord')
 * @returns {Promise<WalletMapping>} The updated or created mapping
 */
async function updateWalletMapping(discordId, walletAddress, platform = 'discord') {
  try {
    // Update the mapping if it exists, create if it doesn't
    const [mapping, created] = await WalletMapping.upsert({
      discordId,
      walletAddress,
      platform,
      lastUpdated: new Date()
    });
    
    // Emit event when wallet mapping is created/updated
    walletEvents.emit('wallet-updated', { discordId, walletAddress, platform });
    
    console.log(`[WalletMapping] ${created ? 'Created' : 'Updated'} mapping for Discord user ${discordId}: ${walletAddress}`);
    return mapping;
  } catch (error) {
    console.error(`[WalletMapping] Error updating wallet mapping for Discord user ${discordId}:`, error);
    throw error;
  }
}

/**
 * Performs a background wallet lookup for a Discord user and updates the cache
 * This is explicitly designed to be non-blocking and can be called without awaiting
 * 
 * @param {string} discordId - Discord user ID
 * @returns {Promise<void>} Promise that resolves when done (but doesn't need to be awaited)
 */
async function backgroundWalletLookup(discordId) {
  try {
    console.log(`[WalletMapping] Starting background wallet lookup for Discord user ${discordId}`);
    
    // Call Account Kit SDK
    const walletAddress = await getUserWallet(discordId);
    
    if (walletAddress) {
      // Update cache with new wallet address
      await updateWalletMapping(discordId, walletAddress);
      console.log(`[WalletMapping] Background lookup complete for Discord user ${discordId}: ${walletAddress}`);
    } else {
      console.log(`[WalletMapping] No wallet found in background lookup for Discord user ${discordId}`);
    }
  } catch (error) {
    // Just log errors, don't propagate since this is a background operation
    console.error(`[WalletMapping] Error in background wallet lookup for Discord user ${discordId}:`, error);
  }
}

/**
 * Initializes the wallet mapping service
 * Creates database tables if they don't exist
 */
async function initializeWalletMappingService() {
  try {
    // Ensure wallet mapping table exists
    await WalletMapping.sync();
    console.log('[WalletMapping] Wallet mapping service initialized successfully');
  } catch (error) {
    console.error('[WalletMapping] Failed to initialize wallet mapping service:', error);
    throw error;
  }
}

module.exports = {
  getWalletForDiscordUser,
  updateWalletMapping,
  backgroundWalletLookup,
  initializeWalletMappingService,
  walletEvents
};
