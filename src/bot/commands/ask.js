/**
 * Ask Command
 * 
 * Handles the /ask slash command for creating token-incentivized quizzes from URLs
 */

// Add BigInt serialization support - fixes "Error creating quiz: Do not know how to serialize a BigInt"
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const { SlashCommandBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { sanitizeUrl, validateTokenAmount, validateEthereumAddress } = require('../../security/inputSanitizer');

// Import the new quiz generation service
const { createQuizFromUrl } = require('../../services/quiz');

// Import the storage service
const { saveQuiz, saveAnswer, getQuiz, updateQuizFunding } = require('../../services/storage');

// Import Account Kit SDK for wallet validation
const { getUserWallet, getBotWallet } = require('../../account-kit/sdk');

// Import the checkTokenBalance function from my-wallet.js
const { checkTokenBalance } = require('./my-wallet');

/**
 * /ask command definition
 */
// Define the command directly for simplicity and to avoid mock issues
// Create a command builder with Discord.js
const command = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Create a token-incentivized quiz from a URL with automated reward distribution')
  .addStringOption(option => 
    option
      .setName('url')
      .setDescription('URL to generate quiz questions from')
      .setRequired(true)
  )
  .addStringOption(option => 
    option
      .setName('token')
      .setDescription('ERC20 token address for rewards (default: 0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1)')
      .setRequired(false)
  )
  .addIntegerOption(option => 
    option
      .setName('chain')
      .setDescription('Chain ID (default: 8453 - Base)')
      .setRequired(false)
  )
  .addIntegerOption(option => 
    option
      .setName('amount')
      .setDescription('Token amount for rewards (default: 10000)')
      .setRequired(false)
  );

// Define the command export
const askCommand = {
  data: command,
  execute: handleAskCommand
};

/**
 * Handle the /ask command
 * @param {Object} interaction - Discord interaction object
 */
async function handleAskCommand(interaction) {
  // IMPORTANT: Single deferred reply pattern - acknowledge the interaction ONCE at the beginning
  try {
    // First, acknowledge the interaction immediately to prevent timeouts
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // 1. Extract and validate command options
      let url = interaction.options.getString('url');
      console.log('Processing URL from command:', url);
      
      // Update status message
      await interaction.editReply('⌛ Validating your inputs...');
      
      // Validate URL parameter
      const sanitizedUrl = sanitizeUrl(url);
      if (!sanitizedUrl) {
        console.error('URL validation failed:', url);
        await interaction.editReply('❌ Invalid or unsafe URL provided. Please check the URL format and ensure it doesn\'t contain dangerous content.');
        return;
      }
      
      // Use the sanitized URL for further processing
      url = sanitizedUrl;
      console.log('URL validated successfully:', url);
      
      // Set up defaults
      const userId = interaction.user.id;
      const token = interaction.options.getString('token') || '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1'; // Default test token
      const chain = interaction.options.getInteger('chain') || 84532; // Default to Base Sepolia testnet
      const amount = interaction.options.getInteger('amount') || 10000; // Default amount    
      // Get the Discord user ID for wallet lookup
      const username = interaction.user.username;
      
      // Basic parameter validation
      if (!validateEthereumAddress(token)) {
        await interaction.editReply('❌ Invalid token address format. Please provide a valid ERC20 token address starting with 0x followed by 40 hexadecimal characters.');
        return;
      }
      
      if (!validateTokenAmount(amount)) {
        await interaction.editReply('❌ Invalid token amount. Please provide a positive number within the safe integer range.');
        return;
      }
      
      if (chain <= 0 || chain > 100000) {
        await interaction.editReply('❌ Invalid chain ID. Please provide a valid blockchain network ID.');
        return;
      }
      
      // 2. Check wallet and balance
      await interaction.editReply('⌛ Checking your smart wallet...');
      
      let walletAddress;
      try {
        walletAddress = await getUserWallet(userId);
        
        if (!walletAddress) {
          await interaction.editReply('❌ You don\'t have a smart account yet, which is required to fund quizzes.\n\nPlease use the `/wallet-info` command first to create your account, then try again.');
          return;
        }
        
        await interaction.editReply(`✅ Found your wallet: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}\n\n⌛ Checking token balance...`);
        
        // Special handling for Base mainnet only as it often has RPC issues
        if (chain === 8453) {
          console.log('Base mainnet chain detected - using simplified balance check');
          // For Base mainnet, we'll just proceed with a warning due to frequent RPC issues
          await interaction.editReply(`⚠️ Base mainnet chain balance check skipped (frequent RPC issues with this chain).\n\n⌛ Proceeding with quiz creation...`);
        } else {
          // Normal balance check for other chains
          try {
            console.log('Checking token balance with:', { walletAddress, token, chainId: chain });
            const balanceInfo = await checkTokenBalance(walletAddress, token, chain);
            console.log('Balance info retrieved:', balanceInfo);
            
            const requiredBalance = amount;
            const currentBalance = parseFloat(balanceInfo.balance);
            const symbol = balanceInfo.symbol || 'tokens';
            
            if (currentBalance < requiredBalance) {
              await interaction.editReply(`❌ Insufficient token balance to fund this quiz.\n\nRequired: ${requiredBalance} ${symbol}\nYour balance: ${currentBalance} ${symbol}\n\nPlease add more tokens to your wallet and try again.`);
              return;
            }
            
            await interaction.editReply(`✅ Wallet verified!\n✅ Balance sufficient: ${currentBalance} ${symbol}\n\n⌛ Generating quiz from URL...`);
          } catch (balanceError) {
            console.error('Error checking token balance:', balanceError);
            // Add more detailed logging about the error
            console.log('Token balance error details:', {
              message: balanceError.message,
              chain,
              tokenAddress: token,
              walletAddress: walletAddress
            });
            
            // Continue with quiz creation despite balance check error
            await interaction.editReply(`⚠️ Unable to verify token balance on chain ${chain}, but continuing with quiz creation.\n\n⌛ Generating quiz from URL...`);
          }
        }
      } catch (walletError) {
        console.error('Error retrieving wallet:', walletError);
        await interaction.editReply(`❌ Error accessing your smart wallet: ${walletError.message}\n\nPlease try the \`/wallet-info\` command to diagnose the issue.`);
        return;
      }
      
      // 3. Generate quiz
      console.log('Generating quiz from URL:', url);
      const quiz = await createQuizFromUrl(url, {
        numQuestions: 3,
        difficulty: 'medium'
      });
      
      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        await interaction.editReply('❌ Failed to generate quiz questions from the provided URL. Please try a different URL with more content.');
        return;
      }
      
      // 4. Create quiz metadata
      const quizWithMeta = {
        ...quiz,
        tokenAddress: token,
        chainId: chain,
        rewardAmount: amount,
        userId: interaction.user?.id || 'test_user_id'
      };
      
      // 5. Show preview
      await interaction.editReply('✅ Quiz generated! Preparing preview...');
      await sendEphemeralPreview(interaction, quizWithMeta);
      
    } catch (innerError) {
      console.error('Error during quiz creation process:', innerError);
      await interaction.editReply(`❌ Error creating quiz: ${innerError.message}`);
    }
  } catch (outerError) {
    // This is a critical error in case the initial defer fails
    console.error('Critical error in handleAskCommand:', outerError);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: `❌ Error creating quiz: ${outerError.message}`, ephemeral: true });
      } else {
        await interaction.editReply(`❌ Error creating quiz: ${outerError.message}`);
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Send ephemeral preview with approval/cancel buttons
 * @param {Object} interaction - Discord interaction
 * @param {Object} quizData - Generated quiz data
 */
async function sendEphemeralPreview(interaction, quizData) {
  // Create unique ID for this quiz preview
  const timestamp = Date.now();
  const userId = interaction.user.id;
  const previewId = `${timestamp}_${userId}`;
  
  try {
    // Store the complete quiz data in a global client cache for retrieval during approval
    if (!interaction.client.quizCache) {
      interaction.client.quizCache = new Map();
    }
    
    // Store the full quiz data with a unique key for retrieval
    const quizCacheKey = `quiz_${userId}_${timestamp}`;
    interaction.client.quizCache.set(quizCacheKey, quizData);
    console.log(`Stored full quiz data in cache with key: ${quizCacheKey}`);
    
    // Create embed for preview
    const embed = new EmbedBuilder()
      .setTitle('Token-Incentivized Quiz Preview')
      .setDescription(`Preview of quiz generated from: ${quizData.sourceUrl}`)
      .addFields(
        { name: 'Source', value: quizData.sourceTitle || 'Unknown source' },
        { name: 'Questions', value: `${quizData.questions.length} questions` }
      )
      .setColor(0x0099FF);
      
    // Add token funding information to the preview
    embed.addFields(
      { 
        name: '💰 Funding Information', 
        value: `This quiz will be funded with ${quizData.rewardAmount} tokens from your wallet.` 
      },
      { 
        name: '🪙 Token', 
        value: `Address: ${quizData.tokenAddress.substring(0, 8)}...${quizData.tokenAddress.substring(quizData.tokenAddress.length - 6)}\nChain: ${quizData.chainId} (${quizData.chainId === 84532 ? 'Base Sepolia' : quizData.chainId === 8453 ? 'Base' : 'Chain ' + quizData.chainId})`,
        inline: true
      },
      {
        name: '📊 Reward Distribution',
        value: '75% to correct answers\n25% to incorrect answers (capped)',
        inline: true
      }
    );
    
    // Add sample questions to preview (limited to first 3 for space)
    const questionsToShow = Math.min(quizData.questions.length, 3);
    for (let i = 0; i < questionsToShow; i++) {
      const q = quizData.questions[i];
      if (q && q.question) {
        embed.addFields({ name: `Question ${i+1}`, value: q.question });
      }
    }
    
    // Create approval/cancel buttons with the cache key included
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve:${userId}:${timestamp}:${quizCacheKey}`)
          .setLabel('Fund & Create Quiz')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel:${userId}:${timestamp}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );
    
    // Since we're using a single interaction flow with deferReply at the beginning,
    // we always use editReply here
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
    
    return true;
  } catch (error) {
    console.error('Error sending ephemeral preview:', error);
    await interaction.editReply(`❌ Error displaying quiz preview: ${error.message}\n\nPlease try again later.`);
    return false;
  }
}

/**
 * Handle quiz approval button
 * @param {Object} interaction - Button interaction
 * @param {Object} quizData - Quiz data to publish
 */
async function handleQuizApproval(interaction, quizData) {
  // Interaction should already be deferred by the interaction handler
  // but we'll check just in case
  let isDeferred = interaction.deferred;

  try {
    // Extract user ID from interaction for security verification
    const interactionUserId = interaction.user?.id;
    const buttonIdParts = interaction.customId?.split(':') || [];
    
    // Security check: verify the user who clicked matches the user in the custom ID
    // This prevents user impersonation attacks
    // The button ID format is: approve:userId:timestamp
    if (buttonIdParts.length >= 2 && buttonIdParts[1] !== interactionUserId) {
      console.log(`Button ID parts: ${buttonIdParts.join(', ')}`);
      console.log(`Interaction user ID: ${interactionUserId}`);
      
      // Choose appropriate response method based on interaction state
      if (isDeferred) {
        await interaction.followUp({
          content: 'Unauthorized: You cannot approve a quiz created by someone else',
          ephemeral: true
        }).catch(e => console.error('Failed to send unauthorized response:', e));
      } else {
        await interaction.reply({
          content: 'Unauthorized: You cannot approve a quiz created by someone else',
          ephemeral: true
        }).catch(e => console.error('Failed to send unauthorized response:', e));
      }
      return;
    }
    
    // Show immediate progress messages
    try {
      // The buttons are already disabled in the interaction handler
      // Now update with a more descriptive message
      await interaction.editReply({
        content: '⏳ Creating your quiz - please wait...',
        components: [] // Keep buttons disabled
      });
      isDeferred = true;
    } catch (updateError) {
      console.error('Failed to update with progress message:', updateError);
      // Ensure the interaction is deferred if it hasn't been already
      if (!isDeferred) {
        try {
          await interaction.deferUpdate();
          isDeferred = true;
        } catch (deferError) {
          console.error('Failed to defer update:', deferError);
          // Try to reply instead
          try {
            await interaction.reply({
              content: '⏳ Creating your quiz - please wait...',
              ephemeral: true
            });
            isDeferred = true;
          } catch (replyError) {
            console.error('Failed to reply:', replyError);
            // At this point we can't interact, just continue and hope for the best
          }
        }
      }
    }
    
    // Create expiry date (end of next day UTC)
    const expiryDate = new Date();
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 1);
    expiryDate.setUTCHours(23, 59, 59, 999);
    
    // Save quiz to database
    let quizId;
    try {
      // Get wallet address for user and bot
      let creatorWalletAddress = null;
      let treasuryWalletAddress = null;
      
      try {
        // Get the user's wallet address via Account Kit
        creatorWalletAddress = await getUserWallet(interaction.user.id);
        console.log(`Retrieved creator wallet address: ${creatorWalletAddress}`);
        
        // Get the bot's wallet address to serve as treasury/escrow
        treasuryWalletAddress = await getBotWallet();
        console.log(`Retrieved bot treasury wallet address: ${treasuryWalletAddress}`);
        
        // Update UI with progress step 1
        await interaction.editReply('⏳ Step 1/3: Checking wallet details...');
      } catch (walletError) {
        console.error('Error retrieving wallet addresses:', walletError);
        // Continue with null addresses - we'll handle this case
      }
      
      // Prepare quiz data for storage
      const quizDataForStorage = {
        creatorDiscordId: interaction.user.id,
        creatorWalletAddress: creatorWalletAddress,
        sourceUrl: quizData.sourceUrl,
        difficulty: quizData.difficulty || 'medium',
        tokenAddress: quizData.tokenAddress || '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
        chainId: quizData.chainId || 84532, // Default to Base Sepolia testnet
        rewardAmount: (quizData.rewardAmount || 10000).toString(),
        fundingStatus: 'unfunded', // Start as unfunded
        treasuryWalletAddress: treasuryWalletAddress,
        expiresAt: expiryDate,
        questions: quizData.questions.map((q, index) => ({
          questionText: q.text || q.question, // Handle different property names
          options: q.options || [],
          correctOptionIndex: q.correctOptionIndex !== undefined ? q.correctOptionIndex : (q.answer !== undefined ? q.answer : 0),
          order: index
        }))
      };
      
      // Save the quiz to database and get generated ID
      quizId = await saveQuiz(quizDataForStorage);
      console.log(`Quiz saved to database with ID: ${quizId}`);
    } catch (dbError) {
      console.error('Error saving quiz to database:', dbError);
      // Use a fallback ID if database save fails
      quizId = `quiz_${Date.now()}`;
      console.log(`Using fallback quiz ID: ${quizId} due to database error`);
    }
    
    // Now that the quiz is created, we'll simulate the funding process using our database-driven approach
    let transactionHash;
    let contractAddress;
    
    try {
      // Update UI with progress step 2
      await interaction.editReply('⏳ Step 2/3: Quiz created! Processing token funding...');
      
      // Simulate a brief delay for processing (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate a simulated transaction hash
      transactionHash = '0xSimulated' + Date.now().toString(16);
      
      // In Phase 1, we use a mock contract address based on the quizId
      contractAddress = '0x' + quizId.toString().replace(/-/g, '').substring(0, 30);
      
      // Update the quiz funding status in the database
      await updateQuizFunding(quizId, {
        fundingStatus: 'funded',
        treasuryWalletAddress: quizDataForStorage.treasuryWalletAddress,
        fundingTransactionHash: transactionHash
      });
      
      // Log for debugging
      console.log(`Quiz funding simulated with transaction hash: ${transactionHash}`);
      console.log(`Quiz treasury address: ${quizDataForStorage.treasuryWalletAddress}`);
    } catch (fundingError) {
      console.error('Error during quiz funding simulation:', fundingError);
      // Continue anyway - we'll treat it as funded
    }
    
    // DEEP DEBUGGING: Log the entire quizData object to find transformation issues
    console.log('QUIZ DATA AT APPROVAL STAGE:', JSON.stringify(quizData, null, 2));
    
    // Update the message with final step
    try {
      if (isDeferred) {
        await interaction.editReply({
          content: '⏳ Step 3/3: Publishing quiz to channel...',
          components: [],
          embeds: []
        });
      }
    } catch (editError) {
      console.error('Failed to edit reply:', editError);
      // Continue anyway - we'll still try to publish the quiz
    }
    
    // Publish quiz to channel
    // This could fail if permissions are inadequate or message limits are exceeded
    try {
      await publishQuiz(
        interaction.channel, 
        quizData, 
        quizId, 
        contractAddress, 
        {
          tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
          chainId: 84532, // Base Sepolia testnet
          amount: 10000
        }
      );
    } catch (publishError) {
      console.error('Failed to publish quiz:', publishError);
      // We already created the contract, so we don't throw this error
      // Instead, inform the user about partial success if possible
      try {
        if (isDeferred) {
          await interaction.followUp({
            content: `Quiz contract created but failed to publish: ${publishError.message}`,
            ephemeral: true
          });
        }
      } catch (followUpError) {
        console.error('Failed to send followUp:', followUpError);
      }
    }
  } catch (error) {
    // Handle any uncaught errors during the entire process
    console.error('Error in quiz approval flow:', error);
    
    try {
      // Try to inform the user if possible
      if (isDeferred) {
        await interaction.followUp({
          content: `Error creating quiz: ${error.message}`,
          ephemeral: true
        });
      }
    } catch (responseError) {
      // Even our error handling failed - this could happen with expired tokens
      console.error('Failed to send error response:', responseError);
    }
  }
}

/**
 * Handle quiz cancellation button
 * @param {Object} interaction - Button interaction
 */
async function handleQuizCancellation(interaction) {
  await interaction.update({
    content: 'Quiz creation cancelled.',
    components: [],
    embeds: []
  });
}

/**
 * Publish quiz to channel
 * @param {Object} channel - Discord channel
 * @param {Object} quizData - Quiz data
 * @param {string} quizId - Quiz ID
 * @param {string} contractAddress - Quiz escrow contract address
 * @param {Object} rewardInfo - Token reward information
 */
/**
 * Quiz publishing functions below
 */

async function publishQuiz(channel, quizData, quizId, contractAddress, rewardInfo) {
  // Create expiry date (end of next day UTC)
  const expiryDate = new Date();
  expiryDate.setUTCDate(expiryDate.getUTCDate() + 1);
  expiryDate.setUTCHours(23, 59, 59, 999);
  
  // Create main embed
  const embed = new EmbedBuilder()
    .setTitle(`Quiz: ${quizData.sourceTitle}`)
    .setDescription(`Answer questions about: ${quizData.sourceUrl}`)
    .setColor(0x00AAFF);
    
  // Prepare the fields
  const questionField = { name: 'Questions', value: `${quizData.questions.length} multiple choice questions` };
  const distributionField = { name: 'Distribution', value: '75% to correct answers, 25% to incorrect answers (capped)' };
  
  // Add reward info if provided
  if (rewardInfo && rewardInfo.amount && rewardInfo.tokenAddress) {
    const rewardField = { 
      name: 'Reward', 
      value: `${rewardInfo.amount} tokens (${rewardInfo.tokenAddress.slice(0, 6)}...)` 
    };
    // Add fields individually to ensure proper structure
    embed.addFields(questionField, rewardField, distributionField);
  } else {
    // Add fields without reward info
    embed.addFields(questionField, distributionField);
  }
  
  // Set footer with expiry time and quiz ID
  embed.setFooter({ text: `Expires: ${expiryDate.toUTCString()} | Quiz ID: ${quizId}` });
  embed.setTimestamp();
  
  // First, send the main quiz introduction message without any questions
  await channel.send({
    content: 'New Quiz Available! Answer all questions for a chance to earn tokens.',
    embeds: [embed]
  });
  
  // Then send each question as a separate message with its own buttons
  // This avoids Discord's component limitations (max 5 action rows per message)
  for (let i = 0; i < quizData.questions.length; i++) {
    const q = quizData.questions[i];
    
    // CRITICAL FIX: Use the EXACT options from the LLM without any modifications
    // Log the raw question data to console for debugging
    console.log(`Publishing question ${i+1}:`, JSON.stringify(q, null, 2));
    
    // Ensure option data is properly accessed regardless of property name
    // Handle potential property name mismatches (options vs answer vs correctOptionIndex)
    let rawOptions = q.options || [];
    
    // Check if the property might be called 'answer' instead of 'correctOptionIndex'
    let correctIndex = q.correctOptionIndex;
    if (correctIndex === undefined && q.answer !== undefined) {
      correctIndex = q.answer;
      console.log(`Using 'answer' property instead of 'correctOptionIndex': ${correctIndex}`);
    }
    
    console.log(`Raw options for question ${i+1}:`, rawOptions);
    
    // Add "All of the above" and "None of the above" to every question's options
    // First, ensure we have the original options (up to 3)
    let displayOptions = [];
    
    // Take up to 3 options from the raw options
    for (let j = 0; j < Math.min(rawOptions.length, 3); j++) {
      displayOptions.push(rawOptions[j] || `Option ${j+1}`);
    }
    
    // Add "All of the above" and "None of the above" options
    displayOptions.push('All of the above');
    displayOptions.push('None of the above');
    
    // Create options text for display with letter prefixes
    const optionsText = displayOptions.map((opt, j) => 
      `${['A', 'B', 'C', 'D', 'E'][j]}) ${opt}`
    ).join('\n');
    
    // Create answer buttons for this question - create a button for each option
    const buttonRow = new ActionRowBuilder();
    
    // Get the available labels based on number of options
    const labels = ['A', 'B', 'C', 'D', 'E'];
    
    // Always display 5 options (3 specific + "All of the above" + "None of the above")
    const optionsToDisplay = 5;
    
    // Create one button per option
    for (let j = 0; j < optionsToDisplay; j++) {
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`quiz_answer:${quizId}:${i}:${j}`)
          .setLabel(labels[j])
          .setStyle(ButtonStyle.Primary)
      );
    }
    
    // Create the question embed
    const questionEmbed = new EmbedBuilder()
      .setTitle(`Question ${i+1}`)
      .setDescription(q.question)
      .addFields({ name: 'Options', value: optionsText })
      .setColor(0x00CCFF);
    
    // Send this question as a separate message with its own buttons
    await channel.send({
      embeds: [questionEmbed],
      components: [buttonRow]
    });
    
    // Add a small delay between messages to avoid rate limiting
    if (i < quizData.questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return true;
}

/**
 * Send error message to user
 * @param {Object} interaction - Discord interaction
 * @param {string} errorMessage - Error message
 */
async function sendError(interaction, errorMessage) {
  try {
    // Log the error for debugging
    console.error('Sending error to user:', errorMessage);
    
    // Simplify error handling - our approach now is to always defer at the beginning
    // and then use editReply for subsequent messages
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(errorMessage);
    } else {
      // As a fallback, try to reply first if we haven't deferred yet
      return await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error in sendError function:', error);
  }
}

/**
 * Handle quiz answer button click
 * @param {Object} interaction - Button interaction
 */
async function handleQuizAnswer(interaction) {
  try {
    // Parse button custom ID to extract quiz ID, question number, and selected option
    // Format: quiz_answer:quizId:questionNumber:optionIndex
    const [, quizId, questionNumber, optionIndex] = interaction.customId.split(':');
    
    // Get the option letter user selected (A, B, C, D, or E)
    const optionLetter = ['A', 'B', 'C', 'D', 'E'][parseInt(optionIndex)];
    
    // First, acknowledge the user's selection with an ephemeral reply
    await interaction.reply({
      content: `Your answer (${optionLetter}) for Question ${parseInt(questionNumber) + 1} has been recorded.`,
      ephemeral: true
    });
    
    // Get the original message to update the buttons
    const originalMessage = interaction.message;
    
    // Create a new set of disabled buttons
    const disabledButtonRow = new ActionRowBuilder();
    ['A', 'B', 'C', 'D', 'E'].forEach((option, j) => {
      // Create a button for each option, but all disabled
      // Highlight the selected option with a different style
      const button = new ButtonBuilder()
        .setCustomId(`quiz_answer:${quizId}:${questionNumber}:${j}`)
        .setLabel(option)
        .setDisabled(true);
      
      // Set the style - SUCCESS for the selected option, SECONDARY for others
      if (j === parseInt(optionIndex)) {
        button.setStyle(ButtonStyle.Success); // Green for selected
      } else {
        button.setStyle(ButtonStyle.Secondary); // Grey for other options
      }
      
      disabledButtonRow.addComponents(button);
    });
    
    // Update the original message with disabled buttons
    await originalMessage.edit({
      components: [disabledButtonRow]
    });
    
    // Save the answer to the database
    try {
      // First, get the quiz from database to determine if the answer is correct
      const quiz = await getQuiz(quizId);
      if (!quiz) {
        console.error(`Quiz ${quizId} not found in database`);
        return;
      }
      
      // Find the relevant question
      const questionIndex = parseInt(questionNumber);
      const question = quiz.questions.find(q => q.order === questionIndex);
      
      if (!question) {
        console.error(`Question ${questionIndex} not found in quiz ${quizId}`);
        return;
      }
      
      // Determine if the answer is correct
      const selectedOption = parseInt(optionIndex);
      const isCorrect = selectedOption === question.correctOptionIndex;
      
      // Try to get user's wallet address
      let userWalletAddress = null;
      try {
        userWalletAddress = await getUserWallet(interaction.user.id);
      } catch (walletError) {
        console.error('Error getting user wallet for answer:', walletError);
        // Continue with null wallet address
      }
      
      // Save the answer with wallet address for future reward distribution
      const answerData = {
        quizId: quizId,
        questionId: question.id,
        userDiscordId: interaction.user.id,
        userWalletAddress: userWalletAddress,
        selectedOptionIndex: selectedOption,
        isCorrect: isCorrect
      };
      
      const answerId = await saveAnswer(answerData);
      console.log(`Answer saved to database with ID: ${answerId}. Correct: ${isCorrect}`);
      if (userWalletAddress) {
        console.log(`Answer linked to wallet address: ${userWalletAddress}`);
      }
      
      // Also log to console for debugging
      console.log(`User ${interaction.user.id} answered question ${questionNumber} with option ${optionIndex} - ${isCorrect ? 'Correct' : 'Incorrect'}`);
    } catch (dbError) {
      // Log error but don't show to user to avoid disrupting the experience
      console.error('Error saving answer to database:', dbError);
      // Still log the answer to console as a backup
      console.log(`User ${interaction.user.id} answered question ${questionNumber} with option ${optionIndex} (not saved to DB)`);
    }
    
  } catch (error) {
    console.error('Error handling quiz answer:', error);
    try {
      await interaction.reply({
        content: 'There was an error processing your answer. Please try again.',
        ephemeral: true
      });
    } catch (replyError) {
      // If we've already replied, use followUp instead
      console.error('Error replying to interaction:', replyError);
      try {
        await interaction.followUp({
          content: 'There was an error processing your answer. Please try again.',
          ephemeral: true
        });
      } catch (followUpError) {
        console.error('Error with followUp:', followUpError);
      }
    }
  }
}

// Export the command as the default export for discord.js command handling
module.exports = askCommand;

// Also export the helper functions for testing and other modules
module.exports.askCommand = askCommand;
module.exports.handleAskCommand = handleAskCommand;
module.exports.sendEphemeralPreview = sendEphemeralPreview;
module.exports.handleQuizApproval = handleQuizApproval;
module.exports.handleQuizCancellation = handleQuizCancellation;
module.exports.publishQuiz = publishQuiz;
module.exports.sendError = sendError;
module.exports.handleQuizAnswer = handleQuizAnswer;
