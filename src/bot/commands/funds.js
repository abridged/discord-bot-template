const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQuizzesByCreator } = require('../../services/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('funds')
    .setDescription('View contract-based quizzes you have created'),
  
  // Essential toJSON method for proper command serialization to Discord API
  toJSON() {
    return this.data.toJSON();
  },
  
  async execute(interaction) {
    try {
      // First acknowledge the interaction to prevent timeouts
      await interaction.deferReply({ ephemeral: true });
      
      // Get all quizzes created by this user
      const quizzes = await getQuizzesByCreator(interaction.user.id);
      
      if (!quizzes || quizzes.length === 0) {
        return await interaction.editReply({
          content: 'You haven\'t created any quizzes yet. Use `/quiz` to create your first quiz!',
          ephemeral: true
        });
      }
      
      // Helper function to detect contract-based quizzes
      const isContractBasedQuiz = (quiz) => {
        return quiz.contractAddress && 
               quiz.botRecordingStatus !== undefined &&
               quiz.authorizedBotAddress;
      };
      
      // Filter to only contract-based quizzes
      const contractBasedQuizzes = quizzes.filter(isContractBasedQuiz);
      
      // Create the embed to show contract-based quizzes
      const embed = new EmbedBuilder()
        .setTitle('🧠 Your Contract-Based Quizzes')
        .setColor('#00AAFF')
        .setTimestamp()
        .setFooter({ text: 'Contract-based quizzes use real-time blockchain payouts' });
      
      // Add contract-based quizzes section
      if (contractBasedQuizzes.length > 0) {
        let contractQuizzesText = '';
        contractBasedQuizzes.forEach(quiz => {
          contractQuizzesText += `🔗 **${truncateString(quiz.sourceUrl, 40)}**\n`;
          contractQuizzesText += `• Created: ${new Date(quiz.createdAt).toLocaleString()}\n`;
          contractQuizzesText += `• Contract: \`${quiz.contractAddress}\`\n`;
          contractQuizzesText += `• Bot Status: ${quiz.botRecordingStatus || 'Unknown'}\n`;
          contractQuizzesText += `• Questions: ${quiz.questionCount || 'N/A'}\n\n`;
        });
        
        embed.addFields({
          name: `🔗 Contract-Based Quizzes (${contractBasedQuizzes.length})`,
          value: contractQuizzesText
        });
      } else {
        embed.setDescription('No contract-based quizzes found. Contract-based quizzes provide real-time blockchain payouts as users complete them.');
      }
      
      // Send the response
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error in funds command:', error);
      await interaction.editReply({
        content: 'There was an error retrieving your quizzes. Please try again later.',
        ephemeral: true
      });
    }
  }
};

// Helper function
function truncateString(str, maxLength) {
  if (!str) return 'Unknown';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
