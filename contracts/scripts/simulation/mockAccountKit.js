/**
 * @fileoverview Mock Account Kit SDK for local simulation
 * 
 * Simulates Collab.Land Account Kit SDK interactions to test the quiz workflow
 * without requiring actual Account Kit integration.
 */

const { ethers } = require("hardhat");
const crypto = require('crypto');

/**
 * Mock Account Kit Provider that simulates Collab.Land SDK behavior
 */
class MockAccountKitProvider {
  constructor() {
    this.connectedWallets = new Map(); // discordId -> wallet info
    this.userProfiles = new Map();     // discordId -> user profile
    this.eventListeners = new Map();   // event -> callbacks
    
    // Generate a pool of test wallets
    this.walletPool = [];
    this.initializeWalletPool();
  }

  /**
   * Initialize a pool of test wallets for simulation
   */
  async initializeWalletPool() {
    const signers = await ethers.getSigners();
    
    // Use some of the Hardhat signers as test wallets
    for (let i = 1; i < 15; i++) { // Skip deployer (index 0)
      if (signers[i]) {
        this.walletPool.push({
          address: signers[i].address,
          signer: signers[i],
          isUsed: false
        });
      }
    }
    
    console.log(`MockAccountKit: Initialized ${this.walletPool.length} test wallets`);
  }

  /**
   * Simulate Account Kit connection for a Discord user
   * @param {string} discordId Discord user ID
   * @param {Object} userProfile Optional user profile data
   * @returns {Promise<Object>} Connection result
   */
  async connectWallet(discordId, userProfile = {}) {
    // Check if user already has a connected wallet
    if (this.connectedWallets.has(discordId)) {
      const existing = this.connectedWallets.get(discordId);
      console.log(`MockAccountKit: User ${discordId} already connected to ${existing.address}`);
      return existing;
    }

    // Find an unused wallet from the pool
    const availableWallet = this.walletPool.find(w => !w.isUsed);
    if (!availableWallet) {
      throw new Error('No available wallets in pool for simulation');
    }

    // Mark wallet as used and create connection
    availableWallet.isUsed = true;
    const walletInfo = {
      address: availableWallet.address,
      signer: availableWallet.signer,
      discordId,
      connectedAt: new Date(),
      provider: 'mock-account-kit'
    };

    // Store connections
    this.connectedWallets.set(discordId, walletInfo);
    this.userProfiles.set(discordId, {
      discordId,
      username: userProfile.username || `TestUser${discordId.slice(-4)}`,
      avatar: userProfile.avatar || 'https://example.com/avatar.png',
      ...userProfile
    });

    // Emit connection event
    this.emit('wallet_connected', {
      discordId,
      address: walletInfo.address,
      provider: 'mock'
    });

    console.log(`MockAccountKit: Connected ${discordId} to wallet ${walletInfo.address}`);
    return walletInfo;
  }

  /**
   * Disconnect wallet for a Discord user
   * @param {string} discordId Discord user ID
   * @returns {Promise<boolean>} Success indicator
   */
  async disconnectWallet(discordId) {
    const walletInfo = this.connectedWallets.get(discordId);
    if (!walletInfo) {
      console.log(`MockAccountKit: No wallet connected for ${discordId}`);
      return false;
    }

    // Free up the wallet in the pool
    const wallet = this.walletPool.find(w => w.address === walletInfo.address);
    if (wallet) {
      wallet.isUsed = false;
    }

    // Remove connections
    this.connectedWallets.delete(discordId);
    this.userProfiles.delete(discordId);

    // Emit disconnection event
    this.emit('wallet_disconnected', {
      discordId,
      address: walletInfo.address
    });

    console.log(`MockAccountKit: Disconnected ${discordId} from wallet ${walletInfo.address}`);
    return true;
  }

  /**
   * Get wallet info for a Discord user
   * @param {string} discordId Discord user ID
   * @returns {Object|null} Wallet info or null if not connected
   */
  getWalletInfo(discordId) {
    return this.connectedWallets.get(discordId) || null;
  }

  /**
   * Get user profile for a Discord user
   * @param {string} discordId Discord user ID
   * @returns {Object|null} User profile or null if not found
   */
  getUserProfile(discordId) {
    return this.userProfiles.get(discordId) || null;
  }

  /**
   * Check if user has connected wallet
   * @param {string} discordId Discord user ID
   * @returns {boolean} True if wallet is connected
   */
  isWalletConnected(discordId) {
    return this.connectedWallets.has(discordId);
  }

  /**
   * Get signer for a Discord user
   * @param {string} discordId Discord user ID
   * @returns {Object|null} Ethers signer or null if not connected
   */
  getSigner(discordId) {
    const walletInfo = this.connectedWallets.get(discordId);
    return walletInfo ? walletInfo.signer : null;
  }

  /**
   * Simulate batch wallet connections for multiple users
   * @param {Array<string>} discordIds Array of Discord user IDs
   * @returns {Promise<Array<Object>>} Array of connection results
   */
  async batchConnectWallets(discordIds) {
    const results = [];
    
    for (const discordId of discordIds) {
      try {
        const walletInfo = await this.connectWallet(discordId, {
          username: `SimUser${discordId.slice(-4)}`
        });
        results.push({ discordId, success: true, walletInfo });
      } catch (error) {
        results.push({ discordId, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get all connected wallets (for debugging)
   * @returns {Array<Object>} Array of all connected wallets
   */
  getAllConnectedWallets() {
    return Array.from(this.connectedWallets.entries()).map(([discordId, walletInfo]) => ({
      discordId,
      address: walletInfo.address,
      connectedAt: walletInfo.connectedAt
    }));
  }

  /**
   * Event system for wallet connection/disconnection
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.eventListeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Reset all connections (useful for testing)
   */
  reset() {
    // Free all wallets
    this.walletPool.forEach(wallet => {
      wallet.isUsed = false;
    });

    // Clear all connections
    this.connectedWallets.clear();
    this.userProfiles.clear();
    
    console.log('MockAccountKit: Reset all connections');
  }

  /**
   * Generate realistic Discord IDs for testing
   * @param {number} count Number of IDs to generate
   * @returns {Array<string>} Array of Discord IDs
   */
  static generateDiscordIds(count) {
    const ids = [];
    for (let i = 0; i < count; i++) {
      // Discord IDs are 17-19 digit numbers
      const id = '10' + Math.random().toString().slice(2, 17);
      ids.push(id);
    }
    return ids;
  }
}

module.exports = { MockAccountKitProvider };
