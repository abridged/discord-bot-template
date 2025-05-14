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
        try {
          // Import the quiz answer handler
          const { handleQuizAnswer } = require('../commands/ask');
          return await handleQuizAnswer(interaction);
        } catch (error) {
          console.error('Error in quiz answer button handler:', error);
          try {
            await interaction.reply({ content: `Error processing your answer: ${error.message}`, ephemeral: true });
          } catch (e) {
            await interaction.followUp({ content: `Error processing your answer: ${error.message}`, ephemeral: true });
          }
          return;
        }
      }
      
      // Handle quiz approval/cancel buttons
      const { handleQuizApproval, handleQuizCancellation } = require('../commands/ask');
      
      // Quiz approval button - now using format "approve:userId:timestamp"
      if (interaction.customId.startsWith('approve:')) {
        try {
          // Immediately defer the update to prevent interaction timeouts
          await interaction.deferUpdate().catch(e => console.error('Failed to defer update:', e));
          
          // Extract the quiz data from the message
          const embed = interaction.message.embeds[0];
          const sourceUrl = embed.description.split('from: ')[1];
          const sourceTitle = embed.fields.find(f => f.name === 'Source')?.value || 'Unknown Source';
          
          // Create simple quiz data object based on embed info
          const quizData = {
            sourceUrl,
            sourceTitle,
            questions: []
          };
          
          // Extract questions from embed fields
          embed.fields.forEach(field => {
            if (field.name.startsWith('Question ')) {
              quizData.questions.push({
                question: field.value,
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                answer: 0 // Default to first option
              });
            }
          });
          
          return await handleQuizApproval(interaction, quizData);
        } catch (error) {
          console.error('Error in quiz approval button handler:', error);
          // Use followUp instead of reply if the interaction might have been replied to already
          try {
            if (interaction.deferred) {
              await interaction.followUp({ content: `Error processing quiz approval: ${error.message}`, ephemeral: true });
            } else {
              await interaction.reply({ content: `Error processing quiz approval: ${error.message}`, ephemeral: true });
            }
          } catch (e) {
            console.error('Could not respond to interaction:', e);
          }
          return;
        }
      }
      
      // Quiz cancellation button - now using format "cancel:userId:timestamp"
      if (interaction.customId.startsWith('cancel:')) {
        return await handleQuizCancellation(interaction);
      }
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
