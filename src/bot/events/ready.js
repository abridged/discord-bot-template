const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Log bot login information
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    
    try {
      // Set bot activity status
      client.user.setActivity('Helping users', { type: 'PLAYING' });
    } catch (error) {
      console.error('Failed to set activity status:', error);
    }
    
    // Clear stale quizzes from previous session
    if (client.quizzes) {
      client.quizzes.clear();
    }
    
    // Check for network connectivity
    try {
      await fetch('https://discord.com/api/v10/gateway');
    } catch (error) {
      console.error('Network connectivity check failed:', error);
    }
    
    // Register cleanup handlers for process termination
    process.on('SIGINT', () => {
      console.log('Bot shutting down due to SIGINT');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('Bot shutting down due to SIGTERM');
      process.exit(0);
    });
    
    // Initialize quiz expiry mechanism
    // TODO: Implement quiz expiry functionality in Phase 2
    // The following code is commented out as the function doesn't exist yet
    // try {
    //   await client.initializeQuizExpiry();
    // } catch (error) {
    //   console.error('Failed to initialize quiz expiry:', error);
    // }
    
    // Emit ready event to notify other subsystems
    if (client.emit) {
      client.emit('botReady');
    }
  },
};
