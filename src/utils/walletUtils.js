/**
 * Wallet Utility Functions
 * 
 * Shared utility functions for wallet lookups and token balance checks
 * Used by both /wallet-info and /bot-wallet commands
 */

const { getWalletForDiscordUser } = require('../services/walletMappingService');
const { ethers } = require('ethers');

// ERC20 ABI - minimal ABI for balance and symbol queries
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// Chain information mapping including RPC URLs
const CHAIN_INFO = {
  // Base Sepolia
  '84532': {
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org'
  },
  // Base Mainnet
  '8453': {
    name: 'Base',
    shortName: 'Base',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org'
  },
  // Add more chains as needed
};

/**
 * Default chain ID to use when none is specified
 * Base Sepolia (84532)
 */
const DEFAULT_CHAIN_ID = 84532;

/**
 * Format a number with commas for thousands separators
 * @param {string|number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumberWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a token balance based on decimals
 * @param {string} balance - Raw balance in wei
 * @param {number} decimals - Token decimals
 * @returns {string} Formatted balance
 */
function formatTokenBalance(balance, decimals) {
  // Format with ethers to handle big numbers properly
  const formatted = ethers.utils.formatUnits(balance, decimals);
  
  // Split on decimal point
  const parts = formatted.split('.');
  
  // Format integer part with commas
  const integerPart = formatNumberWithCommas(parts[0]);
  
  // If there's a decimal part, limit to 4 digits and remove trailing zeros
  let decimalPart = '';
  if (parts.length > 1) {
    decimalPart = parts[1].substring(0, 4).replace(/0+$/, '');
    if (decimalPart.length > 0) {
      decimalPart = '.' + decimalPart;
    }
  }
  
  return integerPart + decimalPart;
}

/**
 * Get native token balance for an address
 * @param {string} address - Wallet address
 * @param {ethers.providers.Provider} provider - Ethers provider
 * @returns {Promise<string>} Balance in ETH
 */
async function getNativeBalance(address, provider) {
  try {
    const balanceWei = await provider.getBalance(address);
    return balanceWei;
  } catch (error) {
    console.error(`[walletUtils] Error getting native balance: ${error.message}`);
    throw error;
  }
}

/**
 * Get ERC20 token balance for an address
 * @param {string} address - Wallet address
 * @param {string} tokenAddress - Token contract address
 * @param {ethers.providers.Provider} provider - Ethers provider
 * @returns {Promise<{balance: string, symbol: string, decimals: number}>} Token info
 */
async function getTokenBalance(address, tokenAddress, provider) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // Get balance, symbol and decimals in parallel for efficiency
    const [balance, symbol, decimals] = await Promise.all([
      tokenContract.balanceOf(address),
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);
    
    return { balance, symbol, decimals };
  } catch (error) {
    console.error(`[walletUtils] Error getting token balance: ${error.message}`);
    throw error;
  }
}

/**
 * Get wallet info for a Discord user including address and token balance
 * 
 * @param {Object} options - Options for wallet lookup
 * @param {string} options.discordId - Discord user ID
 * @param {boolean} options.isBot - Whether this is the bot wallet
 * @param {string} [options.tokenAddress] - Token address to check balance for (optional)
 * @param {number} [options.chainId] - Chain ID (optional, defaults to Base Sepolia)
 * @returns {Promise<{walletAddress: string, balanceInfo: Object, chainInfo: Object}>}
 */
async function getWalletInfo({ discordId, isBot, tokenAddress, chainId }) {
  // Set defaults
  const chainIdToUse = chainId || DEFAULT_CHAIN_ID;
  const chainInfoData = CHAIN_INFO[chainIdToUse.toString()] || {
    name: 'Unknown Chain',
    shortName: `Chain ID ${chainIdToUse}`,
    nativeCurrency: 'Unknown',
    rpcUrl: '',
    blockExplorer: ''
  };
  
  try {
    // Get wallet address
    console.log(`[walletUtils] Getting wallet for ${isBot ? 'bot' : 'user'} with ID: ${discordId}`);
    const walletAddress = await getWalletForDiscordUser(discordId, isBot);
    
    if (!walletAddress) {
      throw new Error(`No wallet found for ${isBot ? 'bot' : 'Discord user'} ID: ${discordId}`);
    }
    
    // Initialize provider for the specified chain
    if (!chainInfoData.rpcUrl) {
      throw new Error(`No RPC URL available for chain ID: ${chainIdToUse}`);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(chainInfoData.rpcUrl);
    let balanceInfo;
    
    // Check if we're querying native token or ERC20
    if (!tokenAddress || tokenAddress === 'native') {
      // Get native token balance
      const balanceWei = await getNativeBalance(walletAddress, provider);
      const formattedBalance = formatTokenBalance(balanceWei, 18); // ETH has 18 decimals
      
      console.log(`[walletUtils] Native currency: ${chainInfoData.nativeCurrency}`);
      console.log(`[walletUtils] Chain info: ${JSON.stringify(chainInfoData)}`);
      
      balanceInfo = {
        tokenAddress: 'native',
        tokenSymbol: chainInfoData.nativeCurrency,
        balance: formattedBalance,
        isNative: true
      };
      
      console.log(`[walletUtils] Balance info: ${JSON.stringify(balanceInfo)}`);
    } else {
      // Get ERC20 token balance
      const { balance, symbol, decimals } = await getTokenBalance(walletAddress, tokenAddress, provider);
      const formattedBalance = formatTokenBalance(balance, decimals);
      
      balanceInfo = {
        tokenAddress,
        tokenSymbol: symbol,
        balance: formattedBalance,
        isNative: false
      };
    }
    
    // Log the full result for debugging
    const result = {
      walletAddress,
      balanceInfo,
      chainInfo: chainInfoData
    };
    
    console.log(`[walletUtils] Final result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error('[walletUtils] Error getting wallet info:', error);
    throw error;
  }
}

module.exports = {
  getWalletInfo,
  CHAIN_INFO,
  DEFAULT_CHAIN_ID
};