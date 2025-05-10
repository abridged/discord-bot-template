const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Ignore interactions from the bot itself (security feature)
    if (interaction.user && interaction.client.user && 
        interaction.user.id === interaction.client.user.id) {
      return;
    }

    // Check for cooldowns (anti-spam measure)
    if (interaction.isChatInputCommand()) {
      if (interaction.client.cooldowns && 
          interaction.client.cooldowns.has(interaction.user.id)) {
        const cooldownExpiry = interaction.client.cooldowns.get(interaction.user.id);
        if (Date.now() < cooldownExpiry) {
          await interaction.reply({ 
            content: 'You are on cooldown. Please wait before using commands again.', 
            ephemeral: true 
          });
          return;
        }
      }
    }
    
    // Handle button interactions
    if (interaction.isButton && interaction.isButton()) {
      // Check if this is a quiz answer button
      if (interaction.customId.startsWith('quiz_answer')) {
        if (interaction.client.quizHandler && 
            interaction.client.quizHandler.handleQuizInteraction) {
          return interaction.client.quizHandler.handleQuizInteraction(interaction);
        }
      }
      return; // Other button types not handled yet
    }

    // Process chat commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({ 
          content: `no handler found for /${interaction.commandName}`, 
          ephemeral: true 
        });
        return;
      }

      try {
        await command.execute(interaction);
        
        // Set cooldown if needed
        if (interaction.client.commandCooldowns && 
            interaction.client.commandCooldowns.has(interaction.commandName)) {
          const cooldownDuration = interaction.client.commandCooldowns.get(interaction.commandName);
          interaction.client.cooldowns = interaction.client.cooldowns || new Map();
          interaction.client.cooldowns.set(
            interaction.user.id, 
            Date.now() + cooldownDuration
          );
        }
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          });
          // When we get an error executing a command, we should log it
        }
      }
    }
  },
};
