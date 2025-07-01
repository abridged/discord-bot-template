/**
 * Real Blockchain Service
 * 
 * This service provides actual blockchain interactions using the QuizService
 * for real on-chain deployments and transactions with new MotherFactory/QuizEscrow architecture.
 */

const QuizService = require('./quizService');
const { ethers } = require('ethers');
const { IBlockchainService, TransactionStatus } = require('./mock');
const { getUserWallet, sendTokens, batchSendTokens, getTransaction, getBotWallet, executeUserContractFunction } = require('../../account-kit/sdk');

/**
 * Implementation of the Blockchain Service using real on-chain transactions
 */
class RealBlockchainService extends IBlockchainService {
  constructor(options = {}) {
    super();
    this.transactionStore = new Map(); // In-memory store of transaction statuses
    this.models = options.models; // Database models for storing tx info
    this.quizService = new QuizService();
    this.initialize();
  }

  /**
   * Initialize the service with a provider
   */
  async initialize() {
    try {
      // Try multiple RPC URLs for better reliability
      const rpcUrls = [
        process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
        'https://sepolia.base.org',
        'https://base-sepolia.g.alchemy.com/v2/demo',
        'https://base-sepolia.public.blastapi.io'
      ];
      
      const networkConfig = {
        name: 'base-sepolia',
        chainId: 84532
      };
      
      let provider = null;
      for (const url of rpcUrls) {
        try {
          console.log(`🔧 [BALANCE CHECK] Trying RPC URL: ${url}`);
          provider = new ethers.providers.JsonRpcProvider(url, networkConfig);
          console.log(`✅ [BALANCE CHECK] Provider created for: ${url}`);
          break;
        } catch (error) {
          console.log(`❌ [BALANCE CHECK] Failed to create provider for: ${url} - ${error.message}`);
          continue;
        }
      }
      
      if (!provider) {
        console.error('❌ [BALANCE CHECK] Failed to create any RPC provider');
        return;
      }
      
      // Store the provider for later use when connecting user wallets
      this.provider = provider;
      
      // Initialize the quiz service with the provider (read-only mode by default)
      this.quizService.provider = provider;
      
      // Log basic information
      console.log(`Interacting with MotherFactory at ${this.quizService.motherFactoryAddress}`);
      console.log(`QuizHandler at ${this.quizService.quizHandlerAddress}`);
      console.log(`User wallets will be used to fund quiz escrow contracts`);
      console.log(`Bot wallet will be retrieved on demand when needed`);
    } catch (error) {
      console.error('Failed to initialize real blockchain service:', error);
    }
  }

  /**
   * Update quiz with escrow address returned directly from contract deployment
   * @param {string} quizId - The quiz ID
   * @param {string} escrowAddress - The escrow contract address returned from deployment
   * @returns {Promise<void>}
   */
  async updateQuizWithEscrowAddress(quizId, escrowAddress) {
    if (!this.models || !this.models.Quiz) {
      console.error('QUIZ ESCROW ERROR: No database models available for escrow address update');
      return;
    }
    
    try {
      // Find the quiz
      const quiz = await this.models.Quiz.findOne({
        where: { id: quizId }
      });
      
      if (!quiz) {
        console.error(`QUIZ ESCROW ERROR: Cannot find quiz with ID ${quizId}`);
        return;
      }

      // Get bot wallet address for authorization
      const botWallet = await getBotWallet();
      const botAddress = botWallet?.address;

      // Update the quiz with the escrow address and contract-based fields
      await quiz.update({
        escrowAddress: escrowAddress,
        contractAddress: escrowAddress, // New field for contract-based quizzes
        onChain: true,
        fundingStatus: 'funded', // Mark as funded since the contract deployment includes token transfer
        botRecordingStatus: 'pending', // New field to track bot recording status
        authorizedBotAddress: botAddress // New field for bot authorization
      });
      
      console.log(`Quiz ${quizId} updated with escrow address ${escrowAddress} and bot authorization ${botAddress}`);
    } catch (error) {
      console.error(`QUIZ ESCROW ERROR: Error updating quiz with escrow address:`, error.message);
    }
  }
  
  /**
   * Verify and update the escrow address by parsing ContractDeployed events
   * @param {string} txHash - Transaction hash
   * @returns {Promise<void>}
   */
  async _verifyAndUpdateEscrowAddress(txHash) {
    if (!this.models || !this.models.Quiz) {
      console.error('QUIZ ESCROW ERROR: No database models available for verification');
      return;
    }
    
    try {
      // Find the quiz with this transaction hash
      const quiz = await this.models.Quiz.findOne({
        where: { transactionHash: txHash }
      });
      
      if (!quiz) {
        console.error(`QUIZ ESCROW ERROR: Cannot find quiz with transaction hash ${txHash}`);
        return;
      }
      
      // If we already have an escrow address and it's marked as onChain, nothing to do
      if (quiz.escrowAddress && quiz.onChain) {
        return;
      }
      
      // Get the transaction receipt to parse events
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        console.error(`QUIZ ESCROW ERROR: Cannot get transaction receipt for ${txHash}`);
        return;
      }
      
      // Parse ContractDeployed events from MotherFactory
      const motherFactoryInterface = new ethers.utils.Interface([
        "event ContractDeployed(address indexed creator, string indexed contractType, address indexed contractAddress, address handler, bytes params)"
      ]);
      
      let escrowAddress = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.quizService.motherFactoryAddress.toLowerCase()) {
          try {
            const parsedLog = motherFactoryInterface.parseLog(log);
            if (parsedLog.name === 'ContractDeployed' && parsedLog.args.contractType === 'QuizEscrow') {
              escrowAddress = parsedLog.args.contractAddress;
              console.log(`Found QuizEscrow deployment: ${escrowAddress}`);
              break;
            }
          } catch (parseError) {
            // Not the event we're looking for, continue
          }
        }
      }
      
      if (!escrowAddress) {
        console.error(`QUIZ ESCROW ERROR: No QuizEscrow deployment found in transaction ${txHash}`);
        return;
      }
      
      // Update the quiz record
      await this.updateQuizWithEscrowAddress(quiz.id, escrowAddress);
      
    } catch (error) {
      console.error('QUIZ ESCROW ERROR: Error verifying and updating escrow address:', error.message);
    }
  }

  /**
   * Update quiz record when transaction fails
   * @param {string} txHash - Transaction hash
   * @returns {Promise<void>}
   */
  async _updateQuizWithFailedTransaction(txHash) {
    if (!this.models || !this.models.Quiz) return;
    
    try {
      const quiz = await this.models.Quiz.findOne({
        where: { transactionHash: txHash }
      });
      
      if (!quiz) return;
      
      await quiz.update({
        fundingStatus: 'failed',
        onChain: false
      });
      
    } catch (error) {
      console.error(`QUIZ ESCROW ERROR: Error updating quiz with failed status:`, error.message);
    }
  }

  /**
   * Submit a quiz to the blockchain via MotherFactory v3 user direct deployment
   * @param {Object} quizData - Quiz data including id, tokenAddress, rewardAmount
   * @param {string} userWallet - User's wallet address
   * @param {string} discordUserId - User's Discord ID for platform auth
   * @returns {Object} Transaction and escrow details
   */
  async submitQuiz(quizData, userWallet, discordUserId) {
    console.log('🚀 v3 SUBMIT: RealBlockchainService.submitQuiz CALLED');
    console.log('🚀 v3 SUBMIT: === PARAMETER DEBUG START ===');
    console.log('🚀 v3 SUBMIT: quizData:', JSON.stringify(quizData, null, 2));
    console.log('🚀 v3 SUBMIT: userWallet:', userWallet);
    console.log('🚀 v3 SUBMIT: discordUserId (parameter):', discordUserId);
    console.log('🚀 v3 SUBMIT: quizData.creatorDiscordId:', quizData.creatorDiscordId);
    console.log('🚀 v3 SUBMIT: === PARAMETER DEBUG END ===');
    console.log('🚀 v3 SUBMIT: USE_REAL_BLOCKCHAIN =', process.env.USE_REAL_BLOCKCHAIN);
    console.log('🚀 v3 SUBMIT: MotherFactory address =', this.quizService.motherFactoryAddress);
    console.log('🚀 v3 SUBMIT: Contracts available =', this.quizService.contractsAvailable);
    
    // Import quiz lock service
    const { acquireLock, releaseLock, isLocked } = require('../storage/quiz-lock');
    
    // Check if this quiz is already being processed
    if (isLocked(quizData.id, 'blockchain_submit')) {
      return { status: 'pending', message: 'Quiz is already being processed for blockchain submission', quizId: quizData.id };
    }
    
    // Acquire lock for this quiz
    if (!acquireLock(quizData.id, 'blockchain_submit')) {
      return { status: 'error', message: 'Could not acquire lock for quiz', quizId: quizData.id };
    }
    
    // v3 USER DIRECT DEPLOYMENT: User wallet validation (simplified)
    if (!userWallet && discordUserId) {
      // Try to get wallet from getUserWallet using the Discord ID
      try {
        const { getUserWallet } = require('../../account-kit/sdk');
        userWallet = await getUserWallet(discordUserId);
      } catch (error) {
        console.error(`Error getting wallet from Account Kit: ${error.message}`);
      }
    }
    
    // If we don't have the user's wallet, we must skip to enforce user-only transactions
    if (!userWallet) {
      releaseLock(quizData.id, 'blockchain_submit');
      return {
        status: 'skipped',
        reason: 'no_user_wallet_available'
      };
    }
    
    // Ensure we have a string wallet address
    const walletAddressToUse = typeof userWallet === 'string' ? userWallet : 
                           (userWallet && userWallet.address ? userWallet.address : userWallet);
    
    // Ensure Discord user ID is available for platform auth
    if (!discordUserId && quizData.creatorDiscordId) {
      discordUserId = quizData.creatorDiscordId;
    }
    
    try {
      // Check if USE_REAL_BLOCKCHAIN is enabled
      const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
      
      // Get addresses for the v3 contract architecture
      const motherFactoryAddress = this.quizService.motherFactoryAddress || process.env.MOTHER_FACTORY_ADDRESS;
      
      console.log('🚀 v3 VALIDATION: useRealBlockchain =', useRealBlockchain);
      console.log('🚀 v3 VALIDATION: motherFactoryAddress =', motherFactoryAddress);
      console.log('🚀 v3 VALIDATION: contractsAvailable =', this.quizService.contractsAvailable);
      
      // CRITICAL VALIDATION: If USE_REAL_BLOCKCHAIN=true, contracts must be available
      if (useRealBlockchain && (!motherFactoryAddress || !this.quizService.contractsAvailable)) {
        releaseLock(quizData.id, 'blockchain_submit');
        throw new Error('USE_REAL_BLOCKCHAIN is enabled but MotherFactory v3 contracts are not deployed. Deploy contracts first or set USE_REAL_BLOCKCHAIN=false for development mode.');
      }
      
      console.log('🚀 v3 VALIDATION: VALIDATION PASSED - CONTINUING WITH v3 USER DEPLOYMENT');
      
      if (!motherFactoryAddress) {
        releaseLock(quizData.id, 'blockchain_submit');
        throw new Error('MotherFactory v3 address is not defined. Check the quizService or MOTHER_FACTORY_ADDRESS env variable.');
      }
      
      // Get total reward amount and split according to contract expectations
      const totalRewardAmount = ethers.BigNumber.from(quizData.rewardAmount);
      
      // Split total reward into correct/incorrect pools as contract expects separate values
      // Using 75%/25% split to maintain simple reward structure for contracts
      const correctReward = totalRewardAmount.mul(75).div(100);
      const incorrectReward = totalRewardAmount.mul(25).div(100);
      
      // v3 SIMPLIFIED: Get bot wallet address only for QuizEscrow authorization (not deployment)
      const { getBotWallet } = require('../../account-kit/sdk');
      const botWallet = await getBotWallet();
      
      // Handle both string and object wallet formats
      const botWalletAddress = typeof botWallet === 'string' ? botWallet : 
                            (botWallet && botWallet.address ? botWallet.address : null);
      
      if (!botWalletAddress) {
        releaseLock(quizData.id, 'blockchain_submit');
        throw new Error('Unable to retrieve bot wallet for QuizEscrow authorization');
      }
      
      console.log(`🚀 v3 DEPLOYMENT: User direct deployment via MotherFactory v3`);
      console.log(`🚀 v3 DEPLOYMENT: Quiz ID: ${quizData.id}`);
      console.log(`🚀 v3 DEPLOYMENT: Creator: ${walletAddressToUse}`);
      console.log(`🚀 v3 DEPLOYMENT: Bot Authorized: ${botWalletAddress}`);
      console.log(`🚀 v3 DEPLOYMENT: Total reward: ${ethers.utils.formatEther(totalRewardAmount)} ETH`);
      console.log(`🚀 v3 DEPLOYMENT: Correct reward: ${ethers.utils.formatEther(correctReward)} ETH`);
      console.log(`🚀 v3 DEPLOYMENT: Incorrect reward: ${ethers.utils.formatEther(incorrectReward)} ETH`);
      
      // v3 USER DIRECT DEPLOYMENT: Simplified deployment parameters
      const deploymentParams = {
        creator: walletAddressToUse, // User's wallet address
        authorizedBot: botWalletAddress, // Bot authorized for results recording
        duration: 86400, // 24 hours
        correctReward: correctReward.toString(),
        incorrectReward: incorrectReward.toString(),
        discordUserId: discordUserId // Discord user ID for Account Kit signing
      };
      
      console.log(`🚀 v3 DEPLOYMENT: Deployment params ready:`, deploymentParams);
      
      // Deploy the quiz escrow contract via v3 user direct deployment
      let result;
      try {
        console.log(`🚀 v3 DEPLOYMENT: Calling deployQuizEscrow with v3 user deployment`);
        console.log(`🚀 v3 DEPLOYMENT: QuizService useRealBlockchain = ${this.quizService.useRealBlockchain}`);
        
        result = await this.quizService.deployQuizEscrow(deploymentParams);
        
        console.log(`🚀 v3 DEPLOYMENT: deployQuizEscrow returned:`, result);
        
        // Handle development mode (when USE_REAL_BLOCKCHAIN=false)
        if (!this.quizService.useRealBlockchain) {
          console.log('⚠️  Development mode: Skipping escrow deployment, using mock data');
          
          // Create mock escrow data for development mode
          const mockEscrowAddress = `0x${Math.random().toString(16).substring(2, 42).padStart(40, '0')}`;
          
          // Update quiz in database with mock escrow address
          await this.updateQuizWithEscrowAddress(quizData.id, mockEscrowAddress);
          
          // Return mock result for development mode
          const devModeResult = {
            escrowAddress: mockEscrowAddress,
            expiryTime: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
            status: 'created_dev_mode',
            funderAddress: walletAddressToUse,
            developmentMode: true,
            deploymentMethod: 'user_direct_v3_dev'
          };
          
          releaseLock(quizData.id, 'blockchain_submit');
          return devModeResult;
        }
        
        // Production mode - handle real v3 user deployment
        if (result.deploymentMethod === 'user_direct_v3') {
          console.log(`🚀 v3 DEPLOYMENT: deployQuizEscrow returned:`, result);
          
          // Check if deployment was successful based on transaction hash
          if (result.deploymentMethod === 'user_direct_v3' && result.transactionHash) {
            console.log(`✅ v3 DEPLOYMENT SUCCESS: Transaction submitted with hash ${result.transactionHash}`);
            
            // Store quiz with transaction hash - escrow address can be retrieved later if needed
            let quizRecord = null;
            if (this.storageService && this.storageService.saveQuiz) {
              try {
                quizRecord = await this.storageService.saveQuiz({
                  ...quizData,
                  escrowAddress: result.escrowAddress || 'pending', // Mark as pending if not immediately available
                  transactionHash: result.transactionHash,
                  blockNumber: result.blockNumber,
                  gasUsed: result.gasUsed,
                  totalFunding: result.totalFunding,
                  deploymentMethod: 'user_direct_v3',
                  status: 'deployed' // Mark as successfully deployed
                });
                console.log(`✅ v3 DEPLOYMENT: Quiz saved to database with ID: ${quizRecord?.id || 'N/A'}`);
              } catch (saveError) {
                console.warn(`⚠️  v3 DEPLOYMENT: Could not save to database: ${saveError.message}`);
                // Continue with success - database save is not critical for deployment verification
              }
            } else {
              console.log(`⚠️  v3 DEPLOYMENT: StorageService not available (debug mode)`);
            }
            
            return {
              status: 'success',
              message: 'Quiz escrow deployed successfully via v3 user direct deployment',
              transactionHash: result.transactionHash,
              escrowAddress: result.escrowAddress,
              deploymentMethod: 'user_direct_v3'
            };
          } else {
            throw new Error(`v3 deployment failed: ${result.error || 'Unknown error'}`);
          }
        }
        
        // Legacy validation for escrow address (non-v3 deployments)
        if (!result.escrowAddress && result.deploymentMethod !== 'user_direct_v3') {
          throw new Error('v3 deployment succeeded but no escrow address returned');
        }
        
        // Store transaction info immediately
        this.transactionStore.set(result.transactionHash, {
          status: TransactionStatus.PENDING,
          timestamp: Date.now(),
          quizId: quizData.id,
          escrowAddress: result.escrowAddress,
          deploymentMethod: result.deploymentMethod || 'user_direct_v3'
        });
        
        // Update quiz in database with contract information
        await this.updateQuizWithEscrowAddress(quizData.id, result.escrowAddress);
        
        // Update quiz transaction hash in database
        if (this.models && this.models.Quiz) {
          await this.models.Quiz.update(
            { transactionHash: result.transactionHash },
            { where: { id: quizData.id } }
          );
        }
        
        // Return the escrow contract details
        const resultObj = {
          escrowAddress: result.escrowAddress,
          expiryTime: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
          status: 'created',
          funderAddress: walletAddressToUse,
          developmentMode: false,
          deploymentMethod: result.deploymentMethod || 'user_direct_v3',
          totalFunding: result.totalFunding,
          transactionHash: result.transactionHash
        };
        
        // Release the lock before returning the result
        releaseLock(quizData.id, 'blockchain_submit');
        
        return resultObj;
      } catch (deployError) {
        console.error('🚀 v3 ERROR: User deployment failed:', deployError);
        releaseLock(quizData.id, 'blockchain_submit');
        throw deployError;
      }
    } catch (error) {
      // Make sure to release the lock in case of any errors
      releaseLock(quizData.id, 'blockchain_submit');
      
      // CRITICAL: When USE_REAL_BLOCKCHAIN=true, ALL deployment failures should throw errors to prevent quiz creation
      const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
      if (useRealBlockchain) {
        console.error('🚀 v3 CRITICAL: Production mode deployment failed - throwing error to prevent quiz creation');
        console.error('🚀 v3 ERROR DETAILS:', error.message);
        // In production mode, ALL errors should be thrown to prevent inconsistent state
        throw new Error(`Quiz creation blocked - blockchain deployment failed: ${error.message}`);
      }
      
      // Development mode: return error object for graceful handling
      console.log('🚀 v3 DEV MODE: Returning error object for graceful handling');
      return {
        status: 'error',
        message: `Failed to create quiz escrow: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Submit an answer to the blockchain
   * @param {Object} answerData - Answer data to submit
   * @returns {Promise<Object>} - Object containing transaction hash and status
   */
  async submitAnswer(answerData) {
    // Submitting answer to blockchain
    
    try {
      // First, get the quiz from database to find escrow address if not provided in answerData
      let escrowAddress = answerData.escrowAddress;
      
      // If escrow address wasn't provided in the answerData, try to get it from the database
      if (!escrowAddress && this.models && this.models.Quiz) {
        const quiz = await this.models.Quiz.findByPk(answerData.quizId);
        if (quiz && quiz.escrowAddress) {
          escrowAddress = quiz.escrowAddress;
        }
      }
      
      if (!escrowAddress) {
        throw new Error(`No escrow address found for quiz ${answerData.quizId}`);
      }
      
      // Make sure we have a wallet address for the participant
      if (!answerData.userWalletAddress) {
        throw new Error(`No wallet address provided for answer to quiz ${answerData.quizId}`);
      }
      
      // Adding on-chain answer
      
      // Submit answer on-chain
      const tx = await this.quizService.addAnswer(
        answerData.quizId,
        answerData.userWalletAddress,
        answerData.isCorrect
      );
      
      // Store transaction hash
      const txHash = tx.hash;
      
      // Start transaction monitoring
      this._monitorTransaction(txHash);
      
      return txHash;
    } catch (error) {
      console.error('QUIZ ESCROW ERROR: Failed to submit answer to blockchain:', error.message);
      throw new Error(`Blockchain transaction failed: ${error.message}. No mock fallback available to prevent data confusion.`);
    }
  }

  /**
   * Get the status of a transaction
   * @param {string} txHash - Transaction hash
   * @returns {Promise<string>} - Transaction status
   */
  async getTransactionStatus(txHash) {
    // If transaction isn't in our store, try to get it from the blockchain
    if (!this.transactionStore.has(txHash)) {
      try {
        const provider = this.quizService.provider;
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          return TransactionStatus.PENDING;
        }
        
        const status = receipt.status === 1 ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED;
        this.transactionStore.set(txHash, status);
        return status;
      } catch (error) {
        console.error(`QUIZ ESCROW ERROR: Failed to get transaction status for ${txHash}:`, error.message);
        return null;
      }
    }
    
    return this.transactionStore.get(txHash);
  }

  /**
   * Get reward distribution for a quiz using the escrow contract
   * @param {string} quizId - Quiz ID
   * @returns {Promise<Object>} - Reward distribution info
   */
  async getRewards(quizId) {
    try {
      // Get the escrow address from the database
      let escrowAddress = null;
      if (this.models && this.models.Quiz) {
        const quiz = await this.models.Quiz.findByPk(quizId);
        if (quiz && quiz.escrowAddress) {
          escrowAddress = quiz.escrowAddress;
        }
      }
      
      if (!escrowAddress) {
        throw new Error(`No escrow address found for quiz ${quizId}`);
      }
      
      // Get on-chain reward information
      const rewards = await this.quizService.getQuizRewards(quizId);
      
      return rewards;
    } catch (error) {
      console.error('QUIZ ESCROW ERROR: Failed to get rewards from blockchain:', error.message);
      // Fall back to mock implementation if there's an error
      
      // Use the same reward calculation logic as the mock service
      if (!this.models) {
        return null;
      }
      
      const quiz = await this.models.Quiz.findByPk(quizId);
      if (!quiz) {
        return null;
      }
      
      // Get all answers for this quiz
      const answers = await this.models.Answer.findAll({
        where: { quizId }
      });
      
      // Calculate rewards
      const totalReward = BigInt(quiz.rewardAmount);
      const correctAnswers = answers.filter(a => a.isCorrect);
      const incorrectAnswers = answers.filter(a => !a.isCorrect);
      
      // 75% to correct answers, 25% to incorrect
      const correctRewardPool = (totalReward * BigInt(75)) / BigInt(100);
      const incorrectRewardPool = totalReward - correctRewardPool;
      
      // Calculate per-answer rewards
      const correctReward = correctAnswers.length > 0 ? 
        correctRewardPool / BigInt(correctAnswers.length) : BigInt(0);
      
      const incorrectReward = incorrectAnswers.length > 0 ? 
        incorrectRewardPool / BigInt(incorrectAnswers.length) : BigInt(0);
      
      // Map user rewards
      const userRewards = {};
      
      // Distribute to correct answers
      for (const answer of correctAnswers) {
        const userId = answer.userDiscordId;
        if (!userRewards[userId]) {
          userRewards[userId] = {
            userDiscordId: userId,
            userWalletAddress: answer.userWalletAddress,
            reward: BigInt(0),
            correctAnswers: 0,
            incorrectAnswers: 0
          };
        }
        
        userRewards[userId].reward += correctReward;
        userRewards[userId].correctAnswers += 1;
      }
      
      // Distribute to incorrect answers
      for (const answer of incorrectAnswers) {
        const userId = answer.userDiscordId;
        if (!userRewards[userId]) {
          userRewards[userId] = {
            userDiscordId: userId,
            userWalletAddress: answer.userWalletAddress,
            reward: BigInt(0),
            correctAnswers: 0,
            incorrectAnswers: 0
          };
        }
        
        userRewards[userId].reward += incorrectReward;
        userRewards[userId].incorrectAnswers += 1;
      }
      
      // Convert to string for JSON compatibility
      const formattedRewards = Object.values(userRewards).map(reward => ({
        ...reward,
        reward: reward.reward.toString()
      }));
      
      return {
        quizId,
        totalReward: totalReward.toString(),
        correctRewardPool: correctRewardPool.toString(),
        incorrectRewardPool: incorrectRewardPool.toString(),
        correctAnswersCount: correctAnswers.length,
        incorrectAnswersCount: incorrectAnswers.length,
        userRewards: formattedRewards
      };
    }
  }

  /**
   * Check if user has sufficient balance to fund a quiz
   * @param {string} userWallet - User's wallet address
   * @param {string} tokenAddress - ERC20 token contract address
   * @param {string} requiredAmount - Required amount in wei/token units
   * @param {number} chainId - Chain ID
   * @returns {Promise<Object>} - Balance check result
   */
  async checkUserBalance(userWallet, tokenAddress, requiredAmount, chainId) {
    try {
      console.log(`[BALANCE CHECK] Starting check for wallet ${userWallet} on chain ${chainId}`);
      console.log(`[BALANCE CHECK] Token: ${tokenAddress}, Required: ${requiredAmount}`);
      
      // Validate inputs before making blockchain calls
      if (!userWallet || !tokenAddress || !requiredAmount) {
        throw new Error(`Invalid parameters: wallet=${userWallet}, token=${tokenAddress}, amount=${requiredAmount}`);
      }
      
      // Validate token address format (basic check)
      if (!ethers.utils.isAddress(tokenAddress)) {
        throw new Error(`Invalid token address format: ${tokenAddress}`);
      }
      
      console.log(`[BALANCE CHECK] Real blockchain check - creating token contract`);
      
      // Create ERC20 contract interface
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];
      
      // Robust provider with retry logic for contract calls
      let tokenContract = null;
      let balance, decimals, symbol;
      
      const rpcUrls = [
        process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
        'https://sepolia.base.org',
        'https://base-sepolia.g.alchemy.com/v2/demo',
        'https://base-sepolia.public.blastapi.io'
      ];
      
      const networkConfig = {
        name: 'base-sepolia',
        chainId: 84532
      };
      
      // Try each RPC URL until we get a successful contract call
      let lastError = null;
      for (const url of rpcUrls) {
        try {
          console.log(`[BALANCE CHECK] Trying contract call with RPC: ${url}`);
          const provider = new ethers.providers.JsonRpcProvider(url, networkConfig);
          tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
          
          console.log(`[BALANCE CHECK] Fetching balance from contract via ${url}`);
          // Test the actual contract calls that were failing
          balance = await tokenContract.balanceOf(userWallet);
          decimals = await tokenContract.decimals();
          symbol = await tokenContract.symbol();
          
          console.log(`[BALANCE CHECK] ✅ Success with RPC: ${url}`);
          break; // Success! Exit the retry loop
          
        } catch (error) {
          console.log(`[BALANCE CHECK] ❌ Failed with RPC ${url}: ${error.message}`);
          lastError = error;
          continue; // Try next RPC URL
        }
      }
      
      // If all RPC URLs failed, throw the last error
      if (!balance) {
        throw lastError || new Error('All RPC endpoints failed for balance check');
      }
      
      console.log(`[BALANCE CHECK] User balance: ${balance.toString()} ${symbol}`);
      console.log(`[BALANCE CHECK] Required: ${requiredAmount} ${symbol}`);
      
      const hasInsufficientBalance = balance.lt(ethers.BigNumber.from(requiredAmount));
      console.log(`[BALANCE CHECK] Has insufficient balance: ${hasInsufficientBalance}`);
      
      const realResult = {
        balance: balance.toString(),
        balanceFormatted: ethers.utils.formatUnits(balance, decimals),
        requiredAmount: requiredAmount.toString(),
        requiredAmountFormatted: ethers.utils.formatUnits(requiredAmount, decimals),
        tokenAddress,
        tokenSymbol: symbol,
        chainId,
        hasInsufficientBalance,
        mockData: false
      };
      console.log(`[BALANCE CHECK] Real result:`, realResult);
      return realResult;
    } catch (error) {
      console.error('[BALANCE CHECK] Error checking user balance:', error);
      
      // Return error state
      const errorResult = {
        balance: '0',
        balanceFormatted: '0',
        requiredAmount: requiredAmount.toString(),
        requiredAmountFormatted: 'Unknown',
        tokenAddress: tokenAddress || 'UNKNOWN',
        tokenSymbol: 'Unknown',
        chainId,
        hasInsufficientBalance: true,
        error: error.message,
        mockData: false
      };
      console.log(`[BALANCE CHECK] Error result:`, errorResult);
      return errorResult;
    }
  }
}

module.exports = RealBlockchainService;
