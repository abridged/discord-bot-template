/**
 * Bot Wallet Command
 * 
 * Displays the bot's treasury wallet address and token balance.
 * Uses the shared wallet utility functions.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getWalletInfo, CHAIN_INFO } = require('../../utils/walletUtils');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot-wallet')
    .setDescription("Display the bot's treasury wallet information")
    .addStringOption(option => 
      option.setName('token')
        .setDescription('Token address to check balance for (or "native" for chain tokens)')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('chain')
        .setDescription('Chain ID (default: 84532 Base Sepolia)')
        .setRequired(false)),
  
  /**
   * Execute the bot wallet command
   * @param {Object} interaction - Discord interaction object
   */
  async execute(interaction) {
    try {
      // Defer reply to give time for the wallet lookup and balance check
      await interaction.deferReply({ ephemeral: true });
      
      // Get command options
      const tokenOption = interaction.options.getString('token');
      const chainOption = interaction.options.getInteger('chain');
      
      // Get Discord client ID from environment variables
      const botDiscordId = process.env.DISCORD_CLIENT_ID;
      if (!botDiscordId) {
        return interaction.editReply({ 
          content: '❌ Bot Discord client ID not configured in environment variables.'
        });
      }
      
      console.log(`[Bot Wallet] Getting treasury wallet for Discord bot ID: ${botDiscordId}`);
      
      // Use shared wallet utility to get wallet info
      const walletInfo = await getWalletInfo({
        discordId: botDiscordId,
        isBot: true,
        tokenAddress: tokenOption || undefined,
        chainId: chainOption || undefined
      });
      
      const { walletAddress, balanceInfo, chainInfo } = walletInfo;
      
      // Create embed to display the wallet address
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Bot Treasury Wallet')
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
      console.error('Error displaying bot wallet:', error);
      
      try {
        // Try to edit the reply if possible
        return interaction.editReply({
          content: `❌ Error displaying bot wallet: ${error.message}`
        });
      } catch (replyError) {
        console.error('Failed to edit reply after error:', replyError);
        
        // If editing reply fails, try to send a new message as fallback
        return interaction.channel?.send({
          content: `❌ Error displaying bot wallet for ${interaction.user}: ${error.message}`,
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
