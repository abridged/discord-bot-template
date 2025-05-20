const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserWallet } = require('../../account-kit/sdk');

// Make sure to use ethers v5 which is compatible with the code
const ethers = require('ethers');

// Log ethers version for debugging
console.log(`Using ethers version: ${ethers.version}`);


// Standard ERC20 ABI for balanceOf function
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  }
];

// Chain information for RPC URLs with fallback endpoints
const CHAIN_INFO = {
  1: { // Ethereum
    name: 'Ethereum',
    rpcUrls: [
      'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth'
    ],
    explorer: 'https://etherscan.io'
  },
  137: { // Polygon
    name: 'Polygon',
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://polygon.llamarpc.com',
      'https://rpc.ankr.com/polygon'
    ],
    explorer: 'https://polygonscan.com'
  },
  8453: { // Base
    name: 'Base',
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base.publicnode.com',
      'https://1rpc.io/base',
      'https://rpc.ankr.com/base'
    ],
    explorer: 'https://basescan.org'
  },
  42161: { // Arbitrum
    name: 'Arbitrum One',
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://rpc.ankr.com/arbitrum'
    ],
    explorer: 'https://arbiscan.io'
  },
  11155111: { // Sepolia
    name: 'Sepolia (Testnet)',
    rpcUrls: [
      'https://rpc.sepolia.org',
      'https://eth-sepolia.public.blastapi.io'
    ],
    explorer: 'https://sepolia.etherscan.io'
  },
  84532: { // Base Sepolia testnet
    name: 'Base Sepolia (Testnet)',
    rpcUrls: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.blockpi.network/v1/rpc/public'
    ],
    explorer: 'https://sepolia.basescan.org'
  },
  // Add more chains as needed
};

// Function to log helpful debug information
function logDebug(title, data) {
  console.log(`\n[WALLET DEBUG] ========== ${title} ==========`);
  try {
    if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  } catch (e) {
    console.log('[Error stringifying data]', data);
  }
  console.log(`[WALLET DEBUG] ========== END ${title} ==========\n`);
}

// Default token information
const DEFAULT_TOKEN = {
  address: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1', // Default from project memories
  chainId: 84532, // Base Sepolia testnet
};

/**
 * Check token balance for a wallet address
 * @param {string} walletAddress - Wallet address to check
 * @param {string} tokenAddress - Token contract address
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} Balance information
 */
async function checkTokenBalance(walletAddress, tokenAddress, chainId) {
  logDebug('CHECK BALANCE REQUEST', {
    walletAddress,
    tokenAddress,
    chainId,
    timestamp: new Date().toISOString()
  });

  try {
    // Make sure we're working with a valid ethereum address
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new Error(`Invalid wallet address format: ${walletAddress}`);
    }

    // Get chain information
    const chain = CHAIN_INFO[chainId];
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    // Try each RPC URL in order until one works
    let provider = null;
    let providerErrors = [];
    
    logDebug('TRYING RPC ENDPOINTS', { 
      chainId, 
      chainName: chain.name, 
      numberOfEndpoints: chain.rpcUrls.length 
    });
    
    for (const rpcUrl of chain.rpcUrls) {
      try {
        logDebug('ATTEMPTING RPC CONNECTION', { rpcUrl });
        
        // Connect to provider with specific network configuration to avoid ENS resolution
        const tempProvider = new ethers.providers.JsonRpcProvider({
          url: rpcUrl,
          skipFetchSetup: false,
          // Disable ENS name resolution which requires mainnet access
          ensAddress: null
        });
        
        // Test the provider with a simple call
        const blockNumber = await tempProvider.getBlockNumber();
        logDebug('RPC CONNECTION SUCCESS', { rpcUrl, blockNumber });
        
        // If we get here, the provider works
        provider = tempProvider;
        break;
      } catch (providerError) {
        const errorInfo = {
          rpcUrl,
          message: providerError.message,
          code: providerError.code || 'UNKNOWN'
        };
        logDebug('RPC CONNECTION FAILED', errorInfo);
        providerErrors.push(errorInfo);
      }
    }
    
    if (!provider) {
      logDebug('ALL RPC ENDPOINTS FAILED', { errors: providerErrors });
      throw new Error(`Could not connect to any RPC endpoint for chain ${chainId} (${chain.name})`);
    }
    
    // For native token (ETH, MATIC, etc.)
    if (tokenAddress.toLowerCase() === 'native') {
      try {
        const balance = await provider.getBalance(walletAddress);
        const result = {
          balance: ethers.utils.formatEther(balance),
          decimals: 18,
          symbol: chain.name.split(' ')[0].slice(0, 3).toUpperCase(), // Use chain short name as symbol
          native: true
        };
        logDebug('NATIVE TOKEN BALANCE', result);
        return result;
      } catch (nativeError) {
        logDebug('NATIVE BALANCE ERROR', { 
          message: nativeError.message,
          code: nativeError.code || 'UNKNOWN',
          stack: nativeError.stack?.split('\n').slice(0, 3)
        });
        throw new Error(`Failed to check native token balance: ${nativeError.message}`);
      }
    }
    
    // Make sure the token address is valid
    if (!ethers.utils.isAddress(tokenAddress)) {
      throw new Error(`Invalid token address format: ${tokenAddress}`);
    }
    
    // For ERC20 tokens
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      logDebug('TOKEN CONTRACT', { 
        address: tokenAddress,
        chainId,
        provider: provider.connection?.url || 'unknown'
      });
      
      // Get token information - handle each call separately for better error tracking
      let balance, decimals, symbol;
      
      try {
        balance = await tokenContract.balanceOf(walletAddress);
        logDebug('BALANCE CALL SUCCESS', { balanceHex: balance.toHexString() });
      } catch (balanceError) {
        logDebug('BALANCE CALL ERROR', { 
          message: balanceError.message,
          code: balanceError.code || 'UNKNOWN',
          reason: balanceError.reason || 'No reason provided',
          data: balanceError.data || 'No data'
        });
        throw new Error(`Failed to check token balance: ${balanceError.message}`);
      }
      
      try {
        decimals = await tokenContract.decimals();
        logDebug('DECIMALS CALL SUCCESS', { decimals: decimals.toString() });
      } catch (decimalsError) {
        logDebug('DECIMALS CALL ERROR', { message: decimalsError.message });
        decimals = 18; // Default to 18 if we can't get decimals
      }
      
      try {
        symbol = await tokenContract.symbol();
        logDebug('SYMBOL CALL SUCCESS', { symbol });
      } catch (symbolError) {
        logDebug('SYMBOL CALL ERROR', { message: symbolError.message });
        symbol = 'TKN'; // Default symbol
      }
      
      // Return formatted balance
      const result = {
        balance: ethers.utils.formatUnits(balance, decimals),
        decimals,
        symbol,
        native: false
      };
      
      logDebug('TOKEN BALANCE RESULT', result);
      return result;
    } catch (tokenError) {
      // Log the detailed error for debugging
      logDebug('TOKEN CONTRACT ERROR', {
        message: tokenError.message,
        code: tokenError.code || 'UNKNOWN',
        reason: tokenError.reason || 'No reason provided',
        data: tokenError.data || 'No data',
        stack: tokenError.stack?.split('\n').slice(0, 3)
      });
      
      // Provide a more specific error message for common issues
      let errorMessage = `Token contract error: ${tokenError.message}`;
      
      if (tokenError.code === 'CALL_EXCEPTION') {
        errorMessage = `Token contract error: call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ]`;
      }
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Error checking token balance:', error);
    throw new Error(`Failed to check token balance: ${error.message}`);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wallet-info')
    .setDescription('Look up your Collab.Land smart account and token balance')
    .addStringOption(option => 
      option.setName('token')
        .setDescription('Token address to check balance for (or "native" for chain tokens)')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('chain')
        .setDescription('Chain ID (default: 8453 Base)')
        .setRequired(false)),

  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get options from the command
      const tokenOption = interaction.options.getString('token');
      const chainOption = interaction.options.getInteger('chain');
      
      // Use defaults if not provided
      const tokenAddress = tokenOption || DEFAULT_TOKEN.address;
      const chainId = chainOption || DEFAULT_TOKEN.chainId;
      
      await interaction.editReply('⏳ Retrieving your Collab.Land smart account...');
      
      // Get or create the user's smart account
      const userId = interaction.user.id;
      const username = interaction.user.username;      
      console.log(`[Account Kit] Getting/creating smart account for Discord user: ${userId} (${username})`);
      
      let walletAddress;
      try {
        walletAddress = await getUserWallet(userId);
      } catch (walletError) {
        console.error('Error retrieving/creating wallet:', walletError);
        return interaction.editReply({ 
          content: `❌ There was an error with your Collab.Land smart account: ${walletError.message}\n\nPlease try again later or contact support if this persists.`, 
          ephemeral: true 
        });
      }
      
      if (!walletAddress) {
        return interaction.editReply({ 
          content: '❌ Unable to create a smart account for your Discord account.\n\nThis could be because the Account Kit API is in a "friends and family" stage and may not be available to all users yet.', 
          ephemeral: true 
        });
      }
      
      await interaction.editReply(`✅ Found your smart account! Checking token balance...`);
      
      // Create embed to display the wallet address
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Your Wallet Information')
        .setDescription(`Your Collab.Land wallet address is linked to your Discord account.`)
        .addFields(
          { name: 'Address', value: `\`${walletAddress}\`` }
        )
        .setTimestamp()
        .setFooter({ text: 'Collab.Land Account Kit Integration' });
      
      // If we have a token address, check balance
      if (tokenAddress) {
        try {
          // Show that we're checking balance
          await interaction.editReply({
            content: `Found your wallet! Checking token balance...`,
            embeds: [embed],
            ephemeral: true
          });
          
          // Get chain info for display
          const chainInfo = CHAIN_INFO[chainId] || { name: `Chain ID ${chainId}` };
          
          // Check token balance
          const balanceInfo = await checkTokenBalance(walletAddress, tokenAddress, chainId);
          
          // Add balance information to the embed
          embed.addFields(
            { 
              name: 'Chain', 
              value: chainInfo.name,
              inline: true 
            },
            { 
              name: 'Token', 
              value: balanceInfo.native ? 'Native Token' : tokenAddress,
              inline: true 
            },
            { 
              name: 'Balance', 
              value: `${balanceInfo.balance} ${balanceInfo.symbol}`,
              inline: true 
            }
          );
          
          // If balance is low, show warning
          if (parseFloat(balanceInfo.balance) < 0.001) {
            embed.setColor(0xFF9900); // Warning color
            embed.addFields({
              name: '⚠️ Low Balance',
              value: 'Your balance may be too low to fund a quiz. Consider adding more funds.'
            });
          }
        } catch (balanceError) {
          console.error('Error checking balance:', balanceError);
          
          // Still show wallet info, but add error about balance check
          embed.addFields({
            name: '❌ Balance Check Failed',
            value: `Could not retrieve token balance: ${balanceError.message}`
          });
        }
      }
      
      // Send the final response
      return interaction.editReply({
        content: null,
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      console.error('Error looking up wallet address:', error);
      return interaction.editReply({
        content: `❌ Error looking up your wallet: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  // Add this for command deployment
  toJSON() {
    return this.data.toJSON();
  },
  
  // Expose for testing
  checkTokenBalance
};
