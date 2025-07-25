/**
 * User Wallet Command
 * 
 * Displays the user's wallet address and token balance.
 * Uses the shared wallet utility functions.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getWalletInfo, CHAIN_INFO } = require('../../utils/walletUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wallet-info')
    .setDescription('Look up your smart account and token balance')
    .addStringOption(option => 
      option.setName('token')
        .setDescription('Token address to check balance for (or "native" for chain tokens)')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('chain')
        .setDescription('Chain ID (default: 84532 Base Sepolia)')
        .setRequired(false)),
  
  /**
   * Execute the wallet info command
   * @param {Object} interaction - Discord interaction object
   */
  async execute(interaction) {
    try {
      // Defer reply to give time for the wallet lookup and balance check
      await interaction.deferReply({ ephemeral: true });
      
      // Get command options
      const tokenOption = interaction.options.getString('token');
      const chainOption = interaction.options.getInteger('chain');
      
      // Get Discord user ID and username
      const userId = interaction.user.id;
      const username = interaction.user.username;
      
      console.log(`[Wallet Info] Getting wallet for Discord user: ${userId} (${username})`);
      
      // Use shared wallet utility to get wallet info
      const walletInfo = await getWalletInfo({
        discordId: userId,
        isBot: false,
        tokenAddress: tokenOption || undefined,
        chainId: chainOption || undefined
      });
      
      const { walletAddress, balanceInfo, chainInfo } = walletInfo;
      
      // Create embed to display the wallet address
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Your Smart Account')
        .setDescription(`\`${walletAddress}\``)
        .setTimestamp();
      
      // Add balance information to embed if available
      if (balanceInfo) {
        if (balanceInfo.error) {
          // Balance check failed, show error
          embed.addFields({
            name: '❌ Balance Check Failed',
            value: `Could not retrieve token balance: ${balanceInfo.error}`
          });
        } else {
          // Balance check succeeded, show details
          embed.addFields(
            { 
              name: 'Chain', 
              value: chainInfo.name,
              inline: true 
            },
            { 
              name: 'Token', 
              value: balanceInfo.isNative ? 'Native Token' : `\`${balanceInfo.tokenAddress}\``,
              inline: true 
            },
            { 
              name: 'Balance', 
              value: `${balanceInfo.balance} ${balanceInfo.tokenSymbol}`,
              inline: true 
            }
          );
        }
      }
      
      // Add promotional message
      embed.addFields({
        name: '\u200b', // Zero-width space for spacing
        value: '🔥 [Gaia TGE soon - don\'t miss out, click here now!](https://www.gaianet.ai/)'
      });
      
      // Send the final response
      return interaction.editReply({
        embeds: [embed]
      });
      
    } catch (error) {
      console.error('Error looking up wallet address:', error);
      
      // Handle specific error for missing wallet
      if (error.message && error.message.includes('No wallet address found')) {
        return interaction.editReply({ 
          content: '❌ Unable to find a smart account for your Discord account.\n\nThis could be because the Account Kit API is in a "friends and family" stage and may not be available to all users yet.'
        });
      }
      
      try {
        // Try to edit the reply if possible
        return interaction.editReply({
          content: `❌ Error looking up your wallet: ${error.message}`
        });
      } catch (replyError) {
        console.error('Failed to edit reply after error:', replyError);
        
        // If editing reply fails, try to send a new message as fallback
        return interaction.channel?.send({
          content: `❌ Error looking up wallet for ${interaction.user}: ${error.message}`,
          ephemeral: true
        }).catch(console.error);
      }
    }
  },
  
  // Add this for command deployment
  toJSON() {
    return this.data.toJSON();
  }
};
