const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    try {
      // Simply use the safeRespond helper which will automatically handle the interaction state
      await interaction.safeRespond('Pong!', { ephemeral: true });
    } catch (error) {
      console.error('Error in ping command:', error);
      
      // Even the error handling is simpler with safeRespond
      try {
        await interaction.safeRespond('Pong! (with error recovery)', { ephemeral: true });
      } catch (fallbackError) {
        console.error('Failed to recover from error in ping command:', fallbackError);
      }
    }
  },
};
