const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
      
      // Check if this is a reward distribution button
      if (interaction.customId.startsWith('distribute_rewards:')) {
        try {
          // Import the reward distribution handler
          const { handleDistributeRewards } = require('../handlers/quiz-distribution-handler');
          return await handleDistributeRewards(interaction);
        } catch (error) {
          console.error('Error in reward distribution button handler:', error);
          try {
            await interaction.reply({ content: `Error distributing rewards: ${error.message}`, ephemeral: true });
          } catch (e) {
            await interaction.followUp({ content: `Error distributing rewards: ${error.message}`, ephemeral: true });
          }
          return;
        }
      }
      
      // Handle quiz approval/cancel buttons
      const { handleQuizApproval, handleQuizCancellation } = require('../commands/ask');
      
      // Quiz approval button - now using format "approve:userId:timestamp:quizCacheKey"
      if (interaction.customId.startsWith('approve:')) {
        try {
          // Immediately update the message to disable all buttons
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel('Creating Quiz... Please Wait')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('cancel:disabled')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );

          // Update the message with disabled buttons first
          await interaction.update({ components: [disabledRow] })
            .catch(e => console.error('Failed to update buttons:', e));
          
          // Then defer any further updates
          await interaction.deferUpdate().catch(e => console.error('Failed to defer update:', e));
          
          // Parse the custom ID to get the quiz cache key
          const customIdParts = interaction.customId.split(':');
          // Format is: approve:userId:timestamp:quizCacheKey
          const quizCacheKey = customIdParts.length >= 4 ? customIdParts[3] : null;
          
          console.log(`Retrieving quiz data with cache key: ${quizCacheKey}`);
          
          let quizData;
          
          // Try to get the quiz data from the cache
          if (quizCacheKey && interaction.client.quizCache && interaction.client.quizCache.has(quizCacheKey)) {
            // Use the cached complete quiz data with all the actual options
            quizData = interaction.client.quizCache.get(quizCacheKey);
            console.log('Successfully retrieved quiz data from cache');
            console.log('Quiz data questions:', JSON.stringify(quizData.questions, null, 2));
          } else {
            // Fallback to extracting from the message if cache lookup fails
            console.warn('Could not find quiz data in cache, falling back to embed extraction');
            
            const embed = interaction.message.embeds[0];
            const sourceUrl = embed.description.split('from: ')[1];
            const sourceTitle = embed.fields.find(f => f.name === 'Source')?.value || 'Unknown Source';
            
            // Create a basic quiz object since we can't recover the full data
            quizData = {
              sourceUrl,
              sourceTitle,
              questions: []
            };
            
            // Extract just the question text (we've lost the options)
            embed.fields.forEach(field => {
              if (field.name.startsWith('Question ')) {
                quizData.questions.push({
                  question: field.value,
                  options: ['Through cryptographic hashing and consensus mechanisms',
                            'By maintaining a distributed and decentralized ledger',
                            'Using proof-of-work or proof-of-stake to validate transactions',
                            'By creating immutable records linked in chronological order'],
                  correctOptionIndex: 0 // Default to first option
                });
              }
            });
          }
          
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
        try {
          // Immediately update the message to disable all buttons
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('approve:disabled')
                .setLabel('Fund & Create Quiz')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel('Cancelling...')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );

          // Update the message with disabled buttons first
          await interaction.update({ components: [disabledRow] })
            .catch(e => console.error('Failed to update buttons:', e));
          
          return await handleQuizCancellation(interaction);
        } catch (error) {
          console.error('Error in quiz cancellation button handler:', error);
          try {
            await interaction.followUp({ content: `Error cancelling quiz: ${error.message}`, ephemeral: true });
          } catch (e) {
            console.error('Could not respond to interaction:', e);
          }
          return;
        }
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
