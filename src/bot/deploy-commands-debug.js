require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Debug output
console.log('Environment variables:');
console.log('- DISCORD_TOKEN available:', !!process.env.DISCORD_TOKEN);
console.log('- DISCORD_CLIENT_ID available:', !!process.env.DISCORD_CLIENT_ID);
console.log('- DISCORD_GUILD_ID available:', !!process.env.DISCORD_GUILD_ID);

const commands = [];
// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(`Found ${commandFiles.length} command files:`, commandFiles);

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    // For SlashCommandBuilder objects with toJSON() method
    if (typeof command.data.toJSON === 'function') {
      commands.push(command.data.toJSON());
    } 
    // For plain objects like in the ask.js and leaderboard.js commands
    else {
      commands.push(command.data);
    }
    console.log(`Added command: ${command.data.name || 'unknown'}`);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    console.log(`Commands to be registered:`, commands.map(cmd => cmd.name));

    // Set a guild ID for faster testing - commands update instantly for a specific guild
    // For global commands, leave this blank - but note that global commands can take
    // up to an hour to propagate across all Discord servers
    const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
    
    if (GUILD_ID) {
      console.log(`Deploying commands to guild: ${GUILD_ID}`);
      try {
        const data = await rest.put(
          Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, GUILD_ID),
          { body: commands },
        );
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
      } catch (error) {
        console.error('Error deploying guild commands:', error);
        console.error('REST details:', {
          hasToken: !!rest.token,
          tokenLength: rest.token ? rest.token.length : 0,
          clientId: process.env.DISCORD_CLIENT_ID,
          guildId: GUILD_ID
        });
      }
    } else {
      console.log('No DISCORD_GUILD_ID set, deploying global commands (may take up to an hour to update)');
      try {
        // Let's directly set the token again to make sure
        rest.setToken(process.env.DISCORD_TOKEN);
        
        console.log('REST details before deploy:', {
          hasToken: !!rest.token,
          tokenLength: rest.token ? rest.token.length : 0,
          clientId: process.env.DISCORD_CLIENT_ID
        });
        
        const data = await rest.put(
          Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
          { body: commands },
        );
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
      } catch (error) {
        console.error('Error deploying global commands:', error);
        console.error('REST details:', {
          hasToken: !!rest.token,
          tokenLength: rest.token ? rest.token.length : 0,
          clientId: process.env.DISCORD_CLIENT_ID
        });
      }
    }
  } catch (error) {
    console.error('General error in deploy script:', error);
  }
})();
