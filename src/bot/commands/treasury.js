const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBotWallet } = require('../../account-kit/sdk');

// Make sure to use ethers v5 which is compatible with the code
const ethers = require('ethers');

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
  84532: { // Base Sepolia testnet
    name: 'Base Sepolia (Testnet)',
    rpcUrls: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.blockpi.network/v1/rpc/public'
    ],
    explorer: 'https://sepolia.basescan.org'
  },
};

// Treasury configuration - no defaults, require explicit setup
const TREASURY_CONFIG = {
  // Treasury wallet and token addresses must be configured via environment variables
  // when deploying to production to prevent hardcoded test values
};

// Function to log helpful debug information
function logDebug(title, data) {
  console.log(`\n[TREASURY DEBUG] ========== ${title} ==========`);
  try {
    if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  } catch (e) {
    console.log('[Error stringifying data]', data);
  }
  console.log(`[TREASURY DEBUG] ========== END ${title} ==========\n`);
}

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
    
    for (const rpcUrl of chain.rpcUrls) {
      try {
        provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        // Test the provider with a basic call
        await provider.getBlockNumber();
        break; // If successful, stop trying more RPC URLs
      } catch (e) {
        providerErrors.push({ url: rpcUrl, error: e.message });
        provider = null;
      }
    }
    
    if (!provider) {
      throw new Error(`Failed to connect to any RPC provider for chain ${chainId}: ${JSON.stringify(providerErrors)}`);
    }
    
    let balance, decimals, symbol;
    
    // Handle native token balance check
    if (tokenAddress === 'native' || tokenAddress === 'eth') {
      balance = await provider.getBalance(walletAddress);
      decimals = 18; // ETH and most native tokens use 18 decimals
      symbol = 'ETH'; // Default symbol for native token
      
      // For Base, use Base symbol
      if (chainId === 8453 || chainId === 84531 || chainId === 84532) {
        symbol = 'ETH';
      }
    } 
    // Handle ERC20 token balance check
    else {
      // Check if valid address
      if (!ethers.utils.isAddress(tokenAddress)) {
        throw new Error(`Invalid token address: ${tokenAddress}`);
      }
      
      // Create contract instance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get token balance, decimals, and symbol in parallel
      [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals().catch(() => 18), // Default to 18 if decimals() call fails
        tokenContract.symbol().catch(() => 'TOKEN') // Default to TOKEN if symbol() call fails
      ]);
    }
    
    // Format balance with proper decimal places
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    
    return {
      balance: formattedBalance, 
      decimals,
      symbol,
      native: tokenAddress === 'native' || tokenAddress === 'eth',
      chainId,
      chainName: chain.name
    };
  } catch (error) {
    logDebug('BALANCE CHECK ERROR', { 
      message: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to check balance: ${error.message}`);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('treasury')
    .setDescription('Display the bot\'s treasury wallet information')
    .addStringOption(option => 
      option.setName('token')
        .setDescription('Token address to check balance for (or "native" for chain tokens)')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('chain')
        .setDescription('Chain ID (default: 84532 Base Sepolia)')
        .setRequired(false)),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get options from the command
      const tokenOption = interaction.options.getString('token');
      const chainOption = interaction.options.getInteger('chain');
      
      // Use defaults if not provided
      const tokenAddress = tokenOption || process.env.TREASURY_TOKEN_ADDRESS;
      const chainId = chainOption || process.env.TREASURY_CHAIN_ID;
      
      if (!tokenAddress || !chainId) {
        return interaction.editReply({
          content: '❌ Treasury configuration is not set. Please configure the treasury token address and chain ID via environment variables.',
          ephemeral: true
        });
      }
      
      await interaction.editReply('⏳ Retrieving the treasury wallet...');
      
      // Get the bot's wallet address
      console.log('[Treasury] Getting treasury wallet address');
      
      let walletAddress;
      try {
        walletAddress = await getBotWallet();
      } catch (walletError) {
        console.error('Error retrieving treasury wallet:', walletError);
        return interaction.editReply({ 
          content: `❌ There was an error retrieving the treasury wallet: ${walletError.message}\n\nPlease try again later or contact support if this persists.`, 
          ephemeral: true 
        });
      }
      
      if (!walletAddress) {
        return interaction.editReply({ 
          content: '❌ Unable to retrieve the treasury wallet address.\n\nThis could be because the Account Kit API is in a "friends and family" stage.', 
          ephemeral: true 
        });
      }
      
      await interaction.editReply(`✅ Found the treasury wallet! Checking token balance...`);
      
      // Create embed to display the wallet address
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🏦 Treasury Wallet')
        .setDescription(`This wallet serves as the escrow account for quiz funding and rewards.`)
        .addFields(
          { name: 'Address', value: `\`${walletAddress}\`` }
        )
        .setTimestamp()
        .setFooter({ text: 'Account Kit Integration' });
      
      // If we have a token address, check balance
      if (tokenAddress) {
        try {
          // Show that we're checking balance
          await interaction.editReply({
            content: `Found treasury wallet! Checking token balance...`,
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
              value: 'The treasury may not have enough funds to distribute quiz rewards.'
            });
          }
        } catch (balanceError) {
          console.error('Error checking treasury wallet balance:', balanceError);
          
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
      console.error('Error displaying treasury wallet:', error);
      return interaction.editReply({
        content: `❌ Error displaying treasury wallet: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  // Add this for command deployment
  toJSON() {
    return this.data.toJSON();
  }
};
