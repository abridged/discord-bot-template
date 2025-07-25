/**
 * Mother Quiz Handler
 * 
 * Handles quiz modal submissions from the /mother command.
 * Includes parameter validation, balance checking, and MotherFactory integration.
 */

const { getUserWallet } = require('../../account-kit/sdk');
const { createBlockchainService } = require('../../services/blockchain');

/**
 * Process quiz creation modal submission from /mother command
 * @param {Object} interaction - Discord modal submission interaction
 * @returns {Promise<boolean>} - Success status
 */
async function handleMotherQuizSubmission(interaction) {
  console.log('=== MOTHER QUIZ SUBMISSION START ===');
  console.log(`Processing quiz creation from user: ${interaction.user.tag}`);

  // Declare userWallet at function scope so it's available throughout
  let userWallet = null;

  try {
    // CRITICAL: Defer reply immediately to prevent Discord 3-second timeout
    await interaction.deferReply({ ephemeral: true });
    
    // Show initial processing message
    await interaction.editReply({
      content: '🔍 Processing quiz creation...',
      ephemeral: true
    });
    
    // CRITICAL: Implement duplicate interaction prevention
    const interactionId = interaction.id;
    
    // Skip if this interaction is already being processed
    if (global.interactionTracker.has(interactionId)) {
      console.log(`Duplicate prevention: Interaction ${interactionId} is already being processed, skipping`);
      return false;
    }
    
    // Mark this interaction as being processed
    console.log(`Tracking new mother quiz submission: ${interactionId}`);
    global.interactionTracker.set(interactionId, {
      processing: true,
      startTime: Date.now(),
      userId: interaction.user.id,
      source: 'mother-command'
    });

    // Extract quiz parameters from modal
    const quizParams = extractQuizParameters(interaction);
    if (!quizParams.valid) {
      await interaction.editReply({
        content: quizParams.error,
        ephemeral: true
      });
      global.interactionTracker.delete(interactionId);
      return false;
    }

    // Only perform balance check when USE_REAL_BLOCKCHAIN=true
    const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
    
    if (useRealBlockchain) {
      await interaction.editReply({
        content: '🔍 Checking wallet balance...',
        ephemeral: true
      });

      try {
        console.log(`Checking balance for user ${interaction.user.id}`);
        
        // Get user's wallet address using Account Kit SDK
        userWallet = await getUserWallet(interaction.user.id);
        
        if (!userWallet) {
          await interaction.editReply({
            content: '❌ **ERROR:** Unable to retrieve your wallet address. Please ensure your wallet is connected.',
            ephemeral: true
          });
          global.interactionTracker.delete(interactionId);
          return false;
        }
        
        console.log(`Checking balance for wallet ${userWallet}`);
        
        // Convert amount from frontend units to wei (assuming 18 decimals for most ERC20 tokens)
        const { ethers } = require('ethers');
        const requiredAmountWei = ethers.utils.parseUnits(quizParams.params.fundingAmount.toString(), 18).toString();
        
        // Check user's token balance using blockchain service
        const blockchainService = createBlockchainService();
        const balanceResult = await blockchainService.checkUserBalance(
          userWallet,
          quizParams.params.tokenAddress,
          requiredAmountWei,
          quizParams.params.chainId
        );
        
        if (balanceResult.hasInsufficientBalance) {
          const errorMessage = balanceResult.mockData 
            ? `❌ **[MOCK] Insufficient Balance**\n\n**Required:** ${balanceResult.requiredAmountFormatted || quizParams.params.fundingAmount} ${balanceResult.tokenSymbol || 'tokens'}\n**Available:** ${balanceResult.balanceFormatted || '0'} ${balanceResult.tokenSymbol || 'tokens'}\n\nPlease ensure you have sufficient tokens to fund this quiz.`
            : `❌ **Insufficient Balance**\n\n**Required:** ${balanceResult.requiredAmountFormatted || quizParams.params.fundingAmount} ${balanceResult.tokenSymbol || 'tokens'}\n**Available:** ${balanceResult.balanceFormatted || '0'} ${balanceResult.tokenSymbol || 'tokens'}\n\nPlease ensure you have sufficient tokens to fund this quiz.`;
          
          await interaction.editReply({
            content: errorMessage,
            ephemeral: true
          });
          global.interactionTracker.delete(interactionId);
          return false;
        }
        
        console.log(`✅ Balance check passed for user ${interaction.user.id}: ${balanceResult.balanceFormatted} ${balanceResult.tokenSymbol}`);
            } catch (balanceError) {
        console.error('Error checking user balance:', balanceError);
        await interaction.editReply({
          content: '❌ **ERROR:** Unable to verify your wallet balance. Please try again later.',
          ephemeral: true
        });
        global.interactionTracker.delete(interactionId);
        return false;
      }
    } else {
      console.log('🔗 USE_REAL_BLOCKCHAIN=false: Skipping balance check (dev mode)');
      
      // In development mode, still get wallet for consistency but don't validate balance
      try {
        userWallet = await getUserWallet(interaction.user.id);
        if (userWallet) {
          console.log(`✅ Retrieved wallet for dev mode: ${userWallet}`);
        } else {
          console.log('⚠️  No wallet found in dev mode, continuing without wallet');
        }
      } catch (walletError) {
        console.log('⚠️  Wallet retrieval failed in dev mode, continuing without wallet');
      }
    }

    // Proceed with quiz creation
    // Generate quiz IDs
    const crypto = require('crypto');
    const creationTime = Date.now();
    const urlHash = crypto.createHash('md5').update(quizParams.params.url).digest('hex').substring(0, 10);
    const uniqueQuizId = `${urlHash}_${creationTime}`;
    const quizId = quizParams.params.url; // For backward compatibility

    // Store quiz parameters in global cache for "Take Quiz" button
    global.quizParamsCache.set(uniqueQuizId, {
      url: quizParams.params.url,
      correctRewardPoints: quizParams.params.correctRewardPoints,
      incorrectRewardPoints: quizParams.params.incorrectRewardPoints,
      createdAt: Date.now(),
      createdBy: interaction.user.id,
      uniqueQuizId,
      quizId
    });

    // Always save quiz to database regardless of blockchain mode
    console.log('💾 Saving quiz to database...');
    try {
      const quizData = {
        id: uniqueQuizId,
        quizId: uniqueQuizId,
        creator: interaction.user.id,
        creatorDiscordId: interaction.user.id,
        creatorWalletAddress: userWallet,
        sourceUrl: quizParams.params.url,
        url: quizParams.params.url,
        correctRewardPoints: quizParams.params.correctRewardPoints,
        incorrectRewardPoints: quizParams.params.incorrectRewardPoints,
        // Required database fields with default values for development mode
        tokenAddress: '0x0000000000000000000000000000000000000000', // Default null address
        chainId: 1, // Default to Ethereum mainnet
        rewardAmount: '0', // Default to 0
        difficulty: 'medium',
        questionCount: 0,
        questions: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const { saveQuiz } = require('../../services/storage');
      await saveQuiz(quizData, userWallet);
      console.log('✅ Quiz saved to database successfully');
      
    } catch (saveError) {
      console.error('❌ Quiz save failed:', saveError);
      await interaction.editReply({
        content: `❌ **Quiz Creation Failed**\n\n${saveError.message}\n\nPlease try again.`,
        ephemeral: true
      });
      global.interactionTracker.delete(interactionId);
      return false;
    }

    // Create response embed for public message
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
    const embed = new EmbedBuilder()
      .setColor('#4CAF50')
      .setTitle('Quiz Available!')
      .setDescription(`**${interaction.user.username}** created a new quiz based on this URL:`)
      .addFields(
        { name: 'Source URL', value: quizParams.params.url },
        { name: 'Correct Answer Reward', value: `${quizParams.params.correctRewardPoints} points` },
        { name: 'Incorrect Answer Reward', value: `${quizParams.params.incorrectRewardPoints} points` }
      )
      .setFooter({ text: `Click the button below to take the quiz` })
      .setTimestamp();

    // Create "Take Quiz" button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`quiz_take:${uniqueQuizId}`)
          .setLabel('Take Quiz')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧠')
      );

    // Send the quiz message directly to the channel (not as a followUp to avoid "Original message was deleted")
    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });

    // Now we can safely delete the original ephemeral message
    try {
      await interaction.deleteReply();
    } catch (err) {
      console.log('Could not delete processing message:', err.message);
    }

    // Clean up tracker
    global.interactionTracker.delete(interactionId);
    return true;

  } catch (error) {
    console.error('Error in mother quiz submission:', error);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while processing your quiz. Please try again.',
        ephemeral: true
      });
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
    
    // Clean up tracker
    if (interaction.id) {
      global.interactionTracker.delete(interaction.id);
    }
    
    return false;
  }
}

/**
 * Extract and validate quiz parameters from modal submission
 * @param {Object} interaction - Discord modal submission interaction
 * @returns {Object} - Validation result with parameters or error
 */
function extractQuizParameters(interaction) {
  try {
    // Get the quiz details from the modal
    const url = interaction.fields.getTextInputValue('url');
    const correctRewardPointsStr = interaction.fields.getTextInputValue('correctRewardPoints');
    const incorrectRewardPointsStr = interaction.fields.getTextInputValue('incorrectRewardPoints');
    
    // Parse and validate reward points
    const correctRewardPoints = parseInt(correctRewardPointsStr, 10);
    const incorrectRewardPoints = parseInt(incorrectRewardPointsStr, 10);
    
    if (isNaN(correctRewardPoints) || correctRewardPoints < 0) {
      return {
        valid: false,
        error: '❌ **ERROR:** Correct answer reward points must be a valid positive number.'
      };
    }
    
    if (isNaN(incorrectRewardPoints) || incorrectRewardPoints < 0) {
      return {
        valid: false,
        error: '❌ **ERROR:** Incorrect answer reward points must be a valid positive number.'
      };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return {
        valid: false,
        error: '❌ **ERROR:** Please provide a valid URL for the quiz content.'
      };
    }

    console.log('Quiz parameters validated successfully:', {
      url,
      correctRewardPoints,
      incorrectRewardPoints
    });

    return {
      valid: true,
      params: {
        url,
        correctRewardPoints,
        incorrectRewardPoints
      }
    };

  } catch (error) {
    console.error('Error extracting quiz parameters:', error);
    return {
      valid: false,
      error: '❌ **ERROR:** Failed to process quiz parameters. Please check your inputs and try again.'
    };
  }
}

/**
 * Get chain name for display purposes
 * @param {number} chainId - The chain ID
 * @returns {string} - Human readable chain name
 */
function getChainName(chainId) {
  const chainNames = {
    1: 'Ethereum Mainnet',
    4: 'Rinkeby Testnet',
    5: 'Goerli Testnet',
    8453: 'Base',
    84532: 'Base Sepolia',
    42161: 'Arbitrum One',
    137: 'Polygon',
    10: 'Optimism'
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
}

module.exports = {
  handleMotherQuizSubmission,
  extractQuizParameters,
  getChainName
};
