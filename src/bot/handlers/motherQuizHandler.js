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

    // ALWAYS perform balance check regardless of USE_REAL_BLOCKCHAIN flag
    // This ensures Collab.Land Account Kit functionality works consistently
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
      
      // Balance check passed - proceed with quiz creation
      // Generate quiz IDs
      const crypto = require('crypto');
      const creationTime = Date.now();
      const urlHash = crypto.createHash('md5').update(quizParams.params.url).digest('hex').substring(0, 10);
      const uniqueQuizId = `${urlHash}_${creationTime}`;
      const quizId = quizParams.params.url; // For backward compatibility

      // Determine chain name
      let chainName = 'Unknown Chain';
      if (quizParams.params.chainId === 1) chainName = 'Ethereum Mainnet';
      else if (quizParams.params.chainId === 4) chainName = 'Rinkeby Testnet';
      else if (quizParams.params.chainId === 5) chainName = 'Goerli Testnet';
      else if (quizParams.params.chainId === 42161) chainName = 'Arbitrum One';
      else if (quizParams.params.chainId === 137) chainName = 'Polygon';
      else if (quizParams.params.chainId === 8453) chainName = 'Base';
      else if (quizParams.params.chainId === 84532) chainName = 'Base Sepolia';

      // Store quiz parameters in global cache for "Take Quiz" button
      global.quizParamsCache.set(uniqueQuizId, {
        url: quizParams.params.url,
        tokenAddress: quizParams.params.tokenAddress,
        chainId: quizParams.params.chainId,
        fundingAmount: quizParams.params.fundingAmount,
        chainName,
        createdAt: Date.now(),
        createdBy: interaction.user.id,
        uniqueQuizId,
        quizId
      });

      // Perform blockchain submission if USE_REAL_BLOCKCHAIN=true
      if (process.env.USE_REAL_BLOCKCHAIN === 'true') {
        console.log('🔗 USE_REAL_BLOCKCHAIN=true: Performing blockchain submission during quiz creation...');
        try {
          const quizData = {
            id: uniqueQuizId,
            quizId: uniqueQuizId,
            creator: interaction.user.id,
            creatorDiscordId: interaction.user.id,
            creatorWalletAddress: userWallet,
            sourceUrl: quizParams.params.url,
            url: quizParams.params.url,
            fundingAmount: quizParams.params.fundingAmount,
            chainId: quizParams.params.chainId,
            tokenAddress: quizParams.params.tokenAddress,
            rewardAmount: quizParams.params.fundingAmount,
            difficulty: 'medium',
            questionCount: 0,
            questions: [],
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            rewardsDistribution: {
              correct: quizParams.params.rewardCorrect,
              incorrect: quizParams.params.rewardIncorrect
            }
          };

          const { saveQuiz } = require('../../services/storage');
          await saveQuiz(quizData, userWallet);
          console.log('✅ Blockchain submission completed successfully');
          
        } catch (blockchainError) {
          console.error('❌ Blockchain submission failed:', blockchainError);
          await interaction.editReply({
            content: `❌ **Quiz Creation Failed**\n\n${blockchainError.message}\n\nPlease try again or check your blockchain configuration.`,
            ephemeral: true
          });
          global.interactionTracker.delete(interactionId);
          return false;
        }
      } else {
        console.log('🔗 USE_REAL_BLOCKCHAIN=false: Skipping blockchain submission (dev mode)');
      }

      // Create response embed for public message
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      const devModeLabel = process.env.USE_REAL_BLOCKCHAIN === 'true' ? '' : '[DEV MODE] ';
      
      const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle(`${devModeLabel}Onchain Quiz Available!`)
        .setDescription(`**${interaction.user.username}** created a new quiz based on this URL:`)
        .addFields(
          { name: 'Source URL', value: quizParams.params.url },
          { name: 'Network', value: `${chainName} (${quizParams.params.chainId})` },
          { name: 'Funding Amount', value: `${quizParams.params.fundingAmount} tokens` }
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

      // Send public message with quiz
      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (balanceError) {
      console.error('Error checking user balance:', balanceError);
      await interaction.editReply({
        content: '❌ **ERROR:** Unable to verify your wallet balance. Please try again later.',
        ephemeral: true
      });
      global.interactionTracker.delete(interactionId);
      return false;
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
    const fundingAmountStr = interaction.fields.getTextInputValue('fundingAmount');
    const rewardsDistribution = interaction.fields.getTextInputValue('rewards');
    const chainId = interaction.fields.getTextInputValue('chainId');
    const tokenAddress = interaction.fields.getTextInputValue('tokenAddress');
    
    // Parse and validate funding amount
    const fundingAmount = parseInt(fundingAmountStr, 10);
    if (isNaN(fundingAmount) || fundingAmount < 0) {
      return {
        valid: false,
        error: '❌ **ERROR:** Funding amount must be a valid positive number.'
      };
    }

    // Validate rewards distribution format
    if (!rewardsDistribution.includes(',')) {
      return {
        valid: false,
        error: '❌ **ERROR:** Rewards must be formatted as "correct,incorrect" (two comma-separated values)'
      };
    }
    
    const [rewardCorrect, rewardIncorrect] = rewardsDistribution.split(',');
    const rewardCorrectVal = Number(rewardCorrect);
    const rewardIncorrectVal = Number(rewardIncorrect);
    
    // Validate reward values
    if (isNaN(rewardCorrectVal) || isNaN(rewardIncorrectVal)) {
      return {
        valid: false,
        error: '❌ **ERROR:** Reward values must be valid numbers.'
      };
    }

    // Validate rewards don't exceed funding
    if (rewardCorrectVal > fundingAmount || rewardIncorrectVal > fundingAmount) {
      return {
        valid: false,
        error: `🚫 **VALIDATION ERROR:** Reward amounts (${rewardCorrectVal}, ${rewardIncorrectVal}) cannot exceed the funding amount (${fundingAmount}).\n\nPlease try again with valid values.`
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

    // Validate token address format (basic check for Ethereum address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return {
        valid: false,
        error: '❌ **ERROR:** Please provide a valid Ethereum token address (0x followed by 40 hexadecimal characters).'
      };
    }

    // Validate chain ID
    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum) || chainIdNum < 1) {
      return {
        valid: false,
        error: '❌ **ERROR:** Please provide a valid chain ID.'
      };
    }

    console.log('Quiz parameters validated successfully:', {
      url,
      fundingAmount,
      rewardCorrect: rewardCorrectVal,
      rewardIncorrect: rewardIncorrectVal,
      chainId: chainIdNum,
      tokenAddress
    });

    return {
      valid: true,
      params: {
        url,
        fundingAmount,
        rewardCorrect: rewardCorrectVal,
        rewardIncorrect: rewardIncorrectVal,
        chainId: chainIdNum,
        tokenAddress
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
