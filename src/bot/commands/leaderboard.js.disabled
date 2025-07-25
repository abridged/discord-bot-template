const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard, getUserStats } = require('../../services/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View quiz leaderboard and statistics')
    .addSubcommand(subcommand =>
      subcommand
        .setName('global')
        .setDescription('View the global leaderboard')
        .addStringOption(option =>
          option
            .setName('sort')
            .setDescription('How to sort the leaderboard')
            .setRequired(false)
            .addChoices(
              { name: 'Correct Answers', value: 'correctAnswers' },
              { name: 'Accuracy', value: 'accuracy' },
              { name: 'Total Answered', value: 'totalAnswered' },
              { name: 'Quizzes Taken', value: 'quizzesTaken' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('me')
        .setDescription('View your personal quiz statistics')
    ),
  async execute(interaction) {
    try {
      // First acknowledge the interaction to prevent timeouts
      await interaction.deferReply();
      
      // Determine which subcommand was used
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'global') {
        await handleGlobalLeaderboard(interaction);
      } else if (subcommand === 'me') {
        await handlePersonalStats(interaction);
      }
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      if (interaction.deferred) {
        await interaction.editReply('There was an error executing this command!');
      } else {
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
      }
    }
  },
};

/**
 * Handle the global leaderboard subcommand
 * @param {Object} interaction - Discord interaction
 */
async function handleGlobalLeaderboard(interaction) {
  // Get sort option from command
  const sortBy = interaction.options.getString('sort') || 'correctAnswers';
  
  // Get leaderboard data
  const leaderboardData = await getLeaderboard({ orderBy: sortBy, limit: 10 });
  
  // Check if there's any data
  if (!leaderboardData || leaderboardData.length === 0) {
    await interaction.editReply('No quiz data found yet. Be the first to take a quiz!');
    return;
  }
  
  // Check if there are only active quizzes but no expired ones
  const hasOnlyActiveQuizzes = leaderboardData.every(entry => 
    entry.activeQuizzesTaken > 0 && entry.expiredQuizzesTaken === 0 && entry.totalAnswered === 0
  );
  
  if (hasOnlyActiveQuizzes) {
    await interaction.editReply('Users have participated in quizzes, but all quizzes are still active. Check back after quizzes expire to see scores!');
    return;
  }
  
  // Create embed for leaderboard
  const embed = new EmbedBuilder()
    .setTitle('🏆 Quiz Leaderboard')
    .setDescription(`Top performers sorted by ${sortBy === 'correctAnswers' ? 'correct answers' : 
                                         sortBy === 'accuracy' ? 'accuracy' : 
                                         sortBy === 'totalAnswered' ? 'total questions answered' : 
                                         'quizzes taken'}

**Note:** Only results from expired quizzes are shown to prevent cheating.`)
    .setColor('#00AAFF')
    .setTimestamp();
  
  // Add each user to the leaderboard
  for (let i = 0; i < leaderboardData.length; i++) {
    const entry = leaderboardData[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    
    try {
      // Try to fetch the user to get their username
      const user = await interaction.client.users.fetch(entry.userDiscordId);
      const displayName = user ? user.username : `User ${entry.userDiscordId}`;
      
      embed.addFields({
        name: `${medal} ${displayName}`,
        value: `**Score:** ${sortBy === 'correctAnswers' ? entry.correctAnswers : 
                        sortBy === 'accuracy' ? `${Math.round(entry.accuracy * 100) / 100}%` : 
                        sortBy === 'totalAnswered' ? entry.totalAnswered : 
                        entry.expiredQuizzesTaken}
**Correct/Total:** ${entry.correctAnswers || 0}/${entry.totalAnswered || 0}
**Accuracy:** ${Math.round((entry.accuracy || 0) * 100) / 100}%
**Completed Quizzes:** ${entry.expiredQuizzesTaken || 0}
**Active Quizzes:** ${entry.activeQuizzesTaken || 0}`,
        inline: true
      });
    } catch (error) {
      console.error(`Error fetching user ${entry.userDiscordId}:`, error);
      
      // Fallback to showing the user ID if there's an error
      embed.addFields({
        name: `${medal} User ${entry.userDiscordId.slice(0, 6)}...`,
        value: `**Score:** ${sortBy === 'correctAnswers' ? entry.correctAnswers : 
                        sortBy === 'accuracy' ? `${Math.round(entry.accuracy * 100) / 100}%` : 
                        sortBy === 'totalAnswered' ? entry.totalAnswered : 
                        entry.expiredQuizzesTaken}
**Correct/Total:** ${entry.correctAnswers || 0}/${entry.totalAnswered || 0}
**Accuracy:** ${Math.round((entry.accuracy || 0) * 100) / 100}%
**Completed Quizzes:** ${entry.expiredQuizzesTaken || 0}
**Active Quizzes:** ${entry.activeQuizzesTaken || 0}`,
        inline: true
      });
    }
    
    // Add a blank field for better formatting (2 columns)
    if (i % 2 === 0 && i < leaderboardData.length - 1) {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }
  }
  
  embed.setFooter({ text: 'Use /leaderboard me to see your personal stats' });
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle the personal stats subcommand
 * @param {Object} interaction - Discord interaction
 */
async function handlePersonalStats(interaction) {
  // Get user stats
  const userStats = await getUserStats(interaction.user.id);
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Your Quiz Statistics')
    .setColor('#00AAFF')
    .setTimestamp()
    .setFooter({ text: 'Keep answering quizzes to improve your stats!' });

  if (!userStats) {
    embed.setDescription('No quiz activity yet. Try answering some quizzes first!');
  } else if (userStats.activeQuizzesTaken > 0 && userStats.expiredQuizzesTaken === 0) {
    // User has only participated in active quizzes
    embed.setDescription(`**Quiz Participation**\n\nYou've taken **${userStats.activeQuizzesTaken}** quiz${userStats.activeQuizzesTaken !== 1 ? 'zes' : ''} that ${userStats.activeQuizzesTaken !== 1 ? 'are' : 'is'} still active.\n\n*Your score details will be available after the quizzes expire to prevent cheating.*`);
  } else {
    // User has participated in expired quizzes, show full stats
    // Get user rank
    const rank = await getRank(interaction.user.id, userStats.correctAnswers);
    
    embed.setDescription(`**Rank:** ${rank}\n\n*Note: Score details are only shown for expired quizzes to prevent cheating.*\n\n${formatUserStats(userStats)}`);
  }
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Format user stats for display
 * @param {Object} stats - User statistics
 * @returns {string} - Formatted stats text
 */
function formatUserStats(stats) {
  if (!stats) {
    return 'No quiz activity yet.';
  }
  
  return `**Total Questions:** ${stats.totalAnswered || 0}
**Correct Answers:** ${stats.correctAnswers || 0}
**Accuracy:** ${Math.round((stats.accuracy || 0) * 100) / 100}%
**Completed Quizzes:** ${stats.expiredQuizzesTaken || 0}
**Active Quizzes:** ${stats.activeQuizzesTaken || 0}
**Total Quizzes Taken:** ${stats.quizzesTaken || 0}`;
}

/**
 * Get user rank based on correct answers
 * @param {string} userDiscordId - Discord user ID
 * @param {number} userCorrectAnswers - Number of correct answers
 * @returns {string} - Rank description
 */
async function getRank(userDiscordId, userCorrectAnswers) {
  if (!userCorrectAnswers) return 'Unranked';
  
  try {
    // Get all users sorted by correct answers
    const allUsers = await getLeaderboard({ orderBy: 'correctAnswers', limit: 100 });
    
    // Find user's position
    const userPosition = allUsers.findIndex(user => user.userDiscordId === userDiscordId);
    
    if (userPosition === -1) return 'Unranked';
    
    // Return position (1-indexed)
    const position = userPosition + 1;
    
    // Add medal if in top 3
    if (position === 1) return '🥇 1st Place';
    if (position === 2) return '🥈 2nd Place';
    if (position === 3) return '🥉 3rd Place';
    
    // Otherwise return position with appropriate suffix
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const suffix = position % 100 <= 10 || position % 100 >= 14 ? 
                 suffixes[position % 10 < 4 ? position % 10 : 0] : 
                 suffixes[0];
    
    return `${position}${suffix} Place`;
  } catch (error) {
    console.error('Error getting user rank:', error);
    return 'Rank Unavailable';
  }
}
