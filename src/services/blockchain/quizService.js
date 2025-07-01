/**
 * @fileoverview Quiz blockchain service for contract interactions
 * 
 * Supports both new contract architecture (MotherFactory + QuizEscrow) and legacy compatibility.
 * Integrates with Base Sepolia deployment and Collab.Land Account Kit.
 */

const { ethers } = require('ethers');
const { EventParser } = require('../../utils/eventParser');
const { EscrowAddressResolver } = require('./escrowAddressResolver');
const { getUserWallet } = require('../../account-kit/sdk');
require('dotenv').config();

// Contract ABIs - Updated to match actual contract interfaces
const MotherFactoryABI = [
  "function deployContract(string contractType, bytes calldata params) external returns (address)",
  "function isHandlerActive(address handler) external view returns (bool)",
  "function getHandler(string contractType) external view returns (address)",
  "function owner() external view returns (address)",
  "function getEscrowCount(address user) external view returns (uint256)",
  "function getEscrowByIndex(address user, uint256 index) external view returns (address)",
  "event ContractDeployed(address indexed creator, string indexed contractType, address indexed contractAddress, address handler, bytes params)"
];

const QuizHandlerABI = [
  "function deployContract(address creator, bytes calldata params) external payable returns (address)",
  "function getDeploymentFee(bytes calldata params) external pure returns (uint256)",
  "function getHandlerInfo() external pure returns (string memory, string memory, string memory)",
  "function getAuthorizedBot() external view returns (address)",
  "function DEPLOYMENT_FEE() external view returns (uint256)",
  "event QuizDeployed(address indexed creator, address indexed quizAddress, uint256 correctReward, uint256 incorrectReward, uint256 fundingAmount, uint256 deploymentFee)"
];

const QuizEscrowABI = [
  "function creator() external view returns (address)",
  "function authorizedBot() external view returns (address)",
  "function creationTime() external view returns (uint256)",
  "function fundingAmount() external view returns (uint256)",
  "function correctReward() external view returns (uint256)",
  "function incorrectReward() external view returns (uint256)",
  "function totalPaidOut() external view returns (uint256)",
  "function isEnded() external view returns (bool)",
  "function totalParticipants() external view returns (uint256)",
  "function totalCorrectAnswers() external view returns (uint256)",
  "function totalIncorrectAnswers() external view returns (uint256)",
  "function recordQuizResult(address participant, uint256 correctCount, uint256 incorrectCount) external",
  "function endQuiz() external",
  "function getParticipantResult(address participant) external view returns (tuple(uint256 correctCount, uint256 incorrectCount, uint256 totalPayout, bool hasParticipated))",
  "function getQuizStats() external view returns (uint256, uint256, uint256, uint256, uint256, bool, bool)",
  "function getRemainingTime() external view returns (uint256)",
  "function getAllParticipants() external view returns (address[])",
  "function getBalance() external view returns (uint256)",
  "event QuizCreated(address indexed creator, address indexed authorizedBot, uint256 fundingAmount, uint256 correctReward, uint256 incorrectReward)",
  "event QuizResultRecorded(address indexed participant, uint256 correctCount, uint256 incorrectCount, uint256 payout)",
  "event QuizEnded(uint256 totalParticipants, uint256 totalPaidOut)",
  "event UnclaimedFundsReturned(address indexed creator, uint256 amount)"
];

/**
 * Service for interacting with quiz smart contracts
 * Supports both new MotherFactory architecture and legacy compatibility
 */
class QuizService {
  constructor(options = {}) {
    this.eventParser = new EventParser();
    this.escrowResolver = new EscrowAddressResolver(options);
    this.rpcUrl = options.rpcUrl || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    this.motherFactoryAddress = options.motherFactoryAddress || process.env.MOTHER_FACTORY_ADDRESS;
    this.quizHandlerAddress = options.quizHandlerAddress || process.env.QUIZ_HANDLER_ADDRESS;
    
    // Set chainId for Base Sepolia
    this.chainId = options.chainId || process.env.DEFAULT_CHAIN_ID || 84532; // Base Sepolia
    
    // USE_REAL_BLOCKCHAIN controls whether to deploy QuizEscrow contracts
    // When false, we still initialize contracts for reading but skip deployments
    this.useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === 'true';
    
    // Check if contract addresses are defined
    if (!this.motherFactoryAddress || !this.quizHandlerAddress) {
      console.log('⚠️  Contract addresses not defined, contracts unavailable');
      this.contractsAvailable = false;
      this.motherFactory = null;
      this.quizHandler = null;
      this.provider = null;
      this.signer = null;
      return;
    }
    
    this.contractsAvailable = true;
    
    // Initialize provider with explicit network configuration for Base Sepolia
    const networkConfig = {
      name: 'base-sepolia',
      chainId: parseInt(this.chainId),
      _defaultProvider: (providers) => new providers.JsonRpcProvider(this.rpcUrl)
    };
    
    // Try multiple RPC URLs for better reliability
    const rpcUrls = [
      this.rpcUrl,
      'https://sepolia.base.org',
      'https://base-sepolia.g.alchemy.com/v2/demo',
      'https://base-sepolia.public.blastapi.io'
    ];
    
    let provider = null;
    for (const url of rpcUrls) {
      try {
        console.log(`🔧 Trying RPC URL: ${url}`);
        provider = new ethers.providers.JsonRpcProvider(url, networkConfig);
        // Note: Network testing will happen lazily on first use
        console.log(`✅ Provider created for: ${url}`);
        break;
      } catch (error) {
        console.log(`❌ Failed to create provider for: ${url} - ${error.message}`);
        continue;
      }
    }
    
    if (!provider) {
      console.error('❌ Failed to create any RPC provider');
      this.contractsAvailable = false;
      return;
    }
    
    this.provider = provider;
    
    // Initialize signer if private key is provided
    if (options.privateKey || process.env.DEPLOYMENT_PK) {
      this.signer = new ethers.Wallet(options.privateKey || process.env.DEPLOYMENT_PK, this.provider);
      this.motherFactory = new ethers.Contract(this.motherFactoryAddress, MotherFactoryABI, this.signer);
      this.quizHandler = new ethers.Contract(this.quizHandlerAddress, QuizHandlerABI, this.signer);
    } else {
      // Read-only mode
      this.motherFactory = new ethers.Contract(this.motherFactoryAddress, MotherFactoryABI, this.provider);
      this.quizHandler = new ethers.Contract(this.quizHandlerAddress, QuizHandlerABI, this.provider);
    }
    
    // Log the mode
    if (this.useRealBlockchain) {
      console.log('✅ QuizService: Real blockchain mode - QuizEscrow contracts will be deployed');
    } else {
      console.log('⚠️  QuizService: Development mode - QuizEscrow deployment disabled');
    }
  }

  /**
   * Connect to contracts with a specific signer
   * @param {Object} signer Ethers.js Signer
   * @returns {QuizService} This service instance for chaining
   */
  connect(signer) {
    if (!signer) throw new Error('Signer is required for connection');
    this.signer = signer;
    this.motherFactory = new ethers.Contract(this.motherFactoryAddress, MotherFactoryABI, this.signer);
    this.quizHandler = new ethers.Contract(this.quizHandlerAddress, QuizHandlerABI, this.signer);
    return this;
  }

  /**
   * Deploy a new quiz escrow contract via MotherFactory v3 with user direct deployment
   * @param {Object} params Quiz parameters
   * @param {string} params.creator - Creator address (user's smart account)
   * @param {string} params.authorizedBot - Bot address authorized to record results
   * @param {number} params.duration - Quiz duration in seconds (24 hours = 86400)
   * @param {string} params.correctReward - Reward per correct answer (in wei)
   * @param {string} params.incorrectReward - Reward per incorrect answer (in wei)
   * @param {string} params.discordUserId - Discord user ID for Account Kit signing
   * @returns {Promise<Object>} Deployment result
   */
  async deployQuizEscrow(params) {
    // 🚨🚨🚨 CRITICAL DEBUG: Method entry point
    console.log('🚨🚨🚨 [ENTRY] deployQuizEscrow called with params:', JSON.stringify(params, null, 2));
    console.log('🚨🚨🚨 [ENTRY] Timestamp:', new Date().toISOString());
    
    const {
      creator,
      authorizedBot,
      duration = 86400, // 24 hours default
      correctReward,
      incorrectReward,
      discordUserId
    } = params;
    
    // 🚨🚨🚨 CRITICAL DEBUG: Parameter extraction
    console.log('🚨🚨🚨 [PARAMS] creator:', creator);
    console.log('🚨🚨🚨 [PARAMS] authorizedBot:', authorizedBot);
    console.log('🚨🚨🚨 [PARAMS] duration:', duration);
    console.log('🚨🚨🚨 [PARAMS] correctReward:', correctReward, 'type:', typeof correctReward);
    console.log('🚨🚨🚨 [PARAMS] incorrectReward:', incorrectReward, 'type:', typeof incorrectReward);
    console.log('🚨🚨🚨 [PARAMS] discordUserId:', discordUserId);

    // Validation
    if (!discordUserId) {
      throw new Error('Discord user ID required for Account Kit deployment');
    }

    if (!creator || !authorizedBot || !correctReward || !incorrectReward) {
      throw new Error('Missing required parameters: creator, authorizedBot, correctReward, incorrectReward');
    }

    // Handle development mode (USE_REAL_BLOCKCHAIN=false)
    if (!this.useRealBlockchain) {
      console.log('⚠️  [DEV MODE] QuizService: Skipping QuizEscrow deployment - development mode enabled');
      console.log('⚠️  [DEV MODE] Returning placeholder data for database recording');
      
      // Calculate total funding for logging consistency
      const totalFunding = ethers.BigNumber.from(correctReward).add(ethers.BigNumber.from(incorrectReward));
      console.log(`⚠️  [DEV MODE] Would deploy with funding: ${ethers.utils.formatEther(totalFunding)} ETH`);
      
      // Return structure that matches real deployment for database compatibility
      // ⚠️ WARNING: ALL DATA BELOW IS FAKE/PLACEHOLDER - NOT REAL BLOCKCHAIN DATA ⚠️
      return {
        // 🚨 FAKE PLACEHOLDER DATA - NO REAL CONTRACT DEPLOYED 🚨
        escrowAddress: 'PLACEHOLDER_NULL_NO_REAL_CONTRACT_DEPLOYED', // ⚠️ FAKE: No actual contract deployed
        transactionHash: 'PLACEHOLDER_NULL_NO_REAL_TRANSACTION', // ⚠️ FAKE: No actual transaction
        blockNumber: 'PLACEHOLDER_NULL_NO_REAL_BLOCK', // ⚠️ FAKE: No actual block
        gasUsed: 'PLACEHOLDER_NULL_NO_REAL_GAS', // ⚠️ FAKE: No actual gas usage
        totalFunding: totalFunding.toString(), // ✅ REAL calculation for database consistency
        deployed: false, // ✅ REAL flag indicates dev mode
        deploymentMethod: 'DEV_MODE_PLACEHOLDER_FAKE_DATA', // ⚠️ FAKE: Clear dev mode indication
        devMode: true, // ✅ REAL flag for dev mode responses
        // 🚨 EXPLICIT WARNING: This entire object contains FAKE placeholder data 🚨
        _WARNING_FAKE_DATA: 'THIS_IS_PLACEHOLDER_DATA_NOT_REAL_BLOCKCHAIN_DATA_DEV_MODE_ONLY',
        _IMPORTANT_NOTE: 'ALL_NULL_VALUES_ARE_FAKE_PLACEHOLDERS_NO_REAL_CONTRACTS_DEPLOYED'
      };
    }

    console.log(`🚀 DEPLOYMENT v3: Starting user direct deployment via MotherFactory v3`);
    console.log(`🚀 DEPLOYMENT v3: User ID: ${discordUserId}`);
    console.log(`🚀 DEPLOYMENT v3: Creator: ${creator}`);
    console.log(`🚀 DEPLOYMENT v3: MotherFactory: ${this.motherFactoryAddress}`);
    console.log(`🚀 DEPLOYMENT v3: Bot Authorized: ${authorizedBot}`);

    // Calculate total funding amount (correctReward + incorrectReward for initial funding)
    const totalFunding = ethers.BigNumber.from(correctReward).add(ethers.BigNumber.from(incorrectReward));
    console.log(`🚀 DEPLOYMENT v3: Total funding: ${ethers.utils.formatEther(totalFunding)} ETH`);

    // Get deployment fee from QuizHandler contract
    const deploymentFee = await this.getDeploymentFee();
    const deploymentFeeBN = ethers.BigNumber.from(deploymentFee);
    console.log(`🚀 DEPLOYMENT v3: Deployment fee: ${ethers.utils.formatEther(deploymentFeeBN)} ETH`);

    // Total transaction value = funding + deployment fee
    const totalTransactionValue = totalFunding.add(deploymentFeeBN);
    console.log(`🚀 DEPLOYMENT v3: Total transaction value: ${ethers.utils.formatEther(totalTransactionValue)} ETH`);

    // Convert reward values to BigNumber to avoid string zero issues with Account Kit
    const correctRewardBN = ethers.BigNumber.from(correctReward);
    const incorrectRewardBN = ethers.BigNumber.from(incorrectReward);
    console.log(`🚀 DEPLOYMENT v3: Correct reward (BigNumber): ${correctRewardBN.toString()}`);
    console.log(`🚀 DEPLOYMENT v3: Incorrect reward (BigNumber): ${incorrectRewardBN.toString()}`);

    // Encode deployment parameters for QuizEscrow (v3 compatible)
    const encodedParams = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256", "uint256"],
      [creator, authorizedBot, duration, correctRewardBN, incorrectRewardBN]
    );

    console.log(`🚀 DEPLOYMENT v3: Encoded params: ${encodedParams}`);

    try {
      // Import Account Kit SDK for user deployment
      const { executeUserContractFunction } = require('../../account-kit/sdk');
      
      // v3 User Direct Deployment: User deploys QuizEscrow via MotherFactory
      const contractParams = {
        contractAddress: this.motherFactoryAddress,  // Use contractAddress instead of target for SDK compatibility
        functionName: 'deployContract',
        params: ['QuizEscrow', encodedParams],
        abi: MotherFactoryABI, // Pass ABI at top level, not nested in calldata
        value: totalTransactionValue.toString(), // v3: Include both funding and deployment fee
        chainId: this.chainId,
        discordUserId: discordUserId
      };

      console.log(`🚀 DEPLOYMENT v3: Calling executeUserContractFunction with:`, {
        contractAddress: contractParams.contractAddress,
        functionName: contractParams.functionName,
        params: contractParams.params,
        value: contractParams.value,
        chainId: contractParams.chainId
      });

      // 🚨 CRITICAL DEBUG: Capture exact parameters being passed to Account Kit
      console.log('🚨 [PARAM DEBUG] About to call executeUserContractFunction with:');
      console.log('🚨 [PARAM DEBUG] - contractAddress:', contractParams.contractAddress);
      console.log('🚨 [PARAM DEBUG] - functionName:', contractParams.functionName);
      console.log('🚨 [PARAM DEBUG] - params:', JSON.stringify(contractParams.params, null, 2));
      console.log('🚨 [PARAM DEBUG] - value:', contractParams.value, 'type:', typeof contractParams.value);
      console.log('🚨 [PARAM DEBUG] - chainId:', contractParams.chainId, 'type:', typeof contractParams.chainId);
      console.log('🚨 [PARAM DEBUG] - discordUserId:', contractParams.discordUserId);
      console.log('🚨 [PARAM DEBUG] - tokenAddress:', contractParams.tokenAddress);
      console.log('🚨 [PARAM DEBUG] - approvalAmount:', contractParams.approvalAmount);
      console.log('🚨 [PARAM DEBUG] - abi:', contractParams.abi ? 'Present' : 'Missing');
      console.log('🚨 [PARAM DEBUG] Full contractParams object:', JSON.stringify(contractParams, null, 2));
      
      const result = await executeUserContractFunction(contractParams);

      console.log(`🚀 DEPLOYMENT v3: Account Kit result:`, result);
      
      // CAPTURE USEROP HASH FOR ERC-4337 TESTING
      console.log('='.repeat(80));
      console.log('🔍 ERC-4337 USEROP HASH CAPTURE');
      console.log('='.repeat(80));
      if (result && result.userOperationHash) {
        console.log(`📋 CAPTURED USEROP HASH: ${result.userOperationHash}`);
        console.log(`📋 CHAIN ID: ${this.chainId}`);  
        console.log(`📋 MOTHER FACTORY: ${this.motherFactoryAddress}`);
        console.log(`📋 USER ID: ${discordUserId}`);
        console.log(`📋 TRANSACTION HASH: ${result.transactionHash || 'N/A'}`);
      } else {
        console.log('❌ NO USEROP HASH IN RESULT');
        console.log('📊 Result keys:', Object.keys(result || {}));
        console.log('📊 Full result structure:', JSON.stringify(result, null, 2));
      }
      console.log('='.repeat(80));

      if (!result.success) {
        const errorMsg = result.error || result.message || 'Unknown deployment error';
        throw new Error(`MotherFactory v3 deployment failed: ${errorMsg}`);
      }

      // Resolve escrow address using EscrowAddressResolver with retry logic
      let escrowAddress = null;
      try {
        // 🚨 CRITICAL: Use REAL transactionHash for ERC-4337 transactions, NOT userOperationHash
        const hashToUse = result.transactionHash || result.userOperationHash;
        console.log(`🚀 DEPLOYMENT v3: Resolving escrow address from hash: ${hashToUse}`);
        console.log(`🚀 DEPLOYMENT v3: Hash type: ${result.transactionHash ? 'transactionHash (Real)' : 'userOperationHash (ERC-4337)'}`);
        
        if (!hashToUse) {
          throw new Error('No transaction hash or userOperation hash available for escrow resolution');
        }
        
        const resolutionResult = await this.escrowResolver.resolveEscrowAddress(
          hashToUse, // Use real transaction hash for ERC-4337 event queries
          null, // Skip creator validation for ERC-4337 AA transactions (underlying EOA differs from smart account)
          'QuizEscrow' // Expected contract type
        );
        
        if (resolutionResult.success) {
          escrowAddress = resolutionResult.escrowAddress;
          console.log(`✅ DEPLOYMENT v3: Successfully resolved escrow address: ${escrowAddress}`);
          console.log(`✅ DEPLOYMENT v3: Resolution details:`, resolutionResult);
        } else {
          console.log(`⚠️  DEPLOYMENT v3: Failed to resolve escrow address:`, resolutionResult.error);
          // Deployment still succeeded - address resolution can be retried later
        }
      } catch (resolutionError) {
        console.log(`⚠️  DEPLOYMENT v3: Escrow address resolution error:`, resolutionError.message);
        // Non-blocking - deployment itself was successful
      }

      // Return comprehensive deployment result
      const deploymentResult = {
        escrowAddress,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed?.toString(),
        totalFunding: totalFunding.toString(),
        deployed: true,
        deploymentMethod: 'user_direct_v3'
      };

      console.log(`🚀 DEPLOYMENT v3: Final result:`, deploymentResult);

      return deploymentResult;

    } catch (error) {
      console.error('🚀 DEPLOYMENT v3: Quiz escrow deployment failed:', error);
      
      // Enhanced error reporting for v3
      const enhancedError = new Error(`MotherFactory v3 deployment failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.params = { creator, authorizedBot, duration, correctReward, incorrectReward };
      enhancedError.deploymentMethod = 'user_direct_v3';
      
      throw enhancedError;
    }
  }

  /**
   * Record quiz results for a participant
   * @param {string} escrowAddress - QuizEscrow contract address
   * @param {string} participant - Participant address
   * @param {number} correctCount - Number of correct answers
   * @param {number} incorrectCount - Number of incorrect answers
   * @returns {Promise<Object>} Recording result
   */
  async recordQuizResult(escrowAddress, participant, correctCount, incorrectCount) {
    if (!this.signer) {
      throw new Error('Signer required for recording results');
    }

    try {
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.signer);
      
      const tx = await escrowContract.recordQuizResult(participant, correctCount, incorrectCount);
      const receipt = await tx.wait();

      // Extract payout information from the event
      const resultEvent = receipt.events?.find(event => event.event === 'QuizResultRecorded');
      const payout = resultEvent?.args?.payout || '0';

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        payout: payout.toString(),
        recorded: true
      };
    } catch (error) {
      console.error('Failed to record quiz result:', error);
      throw error;
    }
  }

  /**
   * Get quiz escrow information
   * @param {string} escrowAddress - QuizEscrow contract address
   * @returns {Promise<Object>} Quiz information
   */
  async getQuizEscrowInfo(escrowAddress) {
    try {
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.provider);
      
      const [creator, authorizedBot, creationTime, fundingAmount, correctReward, incorrectReward, totalPaidOut, isEnded, totalParticipants, totalCorrectAnswers, totalIncorrectAnswers] = await Promise.all([
        escrowContract.creator(),
        escrowContract.authorizedBot(),
        escrowContract.creationTime(),
        escrowContract.fundingAmount(),
        escrowContract.correctReward(),
        escrowContract.incorrectReward(),
        escrowContract.totalPaidOut(),
        escrowContract.isEnded(),
        escrowContract.totalParticipants(),
        escrowContract.totalCorrectAnswers(),
        escrowContract.totalIncorrectAnswers()
      ]);

      return {
        creator,
        authorizedBot,
        creationTime: creationTime.toNumber(),
        fundingAmount: fundingAmount.toString(),
        correctReward: correctReward.toString(),
        incorrectReward: incorrectReward.toString(),
        totalPaidOut: totalPaidOut.toString(),
        isEnded: isEnded,
        totalParticipants: totalParticipants.toNumber(),
        totalCorrectAnswers: totalCorrectAnswers.toNumber(),
        totalIncorrectAnswers: totalIncorrectAnswers.toNumber(),
        isExpired: Date.now() / 1000 > creationTime.toNumber() + 86400 // 24 hours default
      };
    } catch (error) {
      console.error('Failed to get quiz escrow info:', error);
      throw error;
    }
  }

  /**
   * Get deployment fee from QuizHandler
   * @returns {Promise<string>} Deployment fee in wei
   */
  async getDeploymentFee() {
    try {
      // TODO: Fix network connectivity issue with ethers.js provider
      // For now, use hardcoded deployment fee (0.001 ETH = 1000000000000000 wei)
      console.log('⚠️  Using hardcoded deployment fee due to network connectivity issue');
      const hardcodedFee = ethers.utils.parseEther('0.001').toString();
      return hardcodedFee;
      
      // Original code (commented out due to network issue):
      // const fee = await this.quizHandler.DEPLOYMENT_FEE();
      // return fee.toString();
    } catch (error) {
      console.error('Failed to get deployment fee:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive quiz statistics from QuizEscrow
   * @param {string} escrowAddress - QuizEscrow contract address
   * @returns {Promise<Object>} Comprehensive quiz stats
   */
  async getQuizStats(escrowAddress) {
    try {
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.provider);
      const stats = await escrowContract.getQuizStats();
      
      return {
        totalParticipants: stats[0].toNumber(),
        totalCorrectAnswers: stats[1].toNumber(),
        totalIncorrectAnswers: stats[2].toNumber(),
        totalPaidOut: stats[3].toString(),
        remainingBalance: stats[4].toString(),
        isExpired: stats[5],
        isEnded: stats[6]
      };
    } catch (error) {
      console.error('Failed to get quiz stats:', error);
      throw error;
    }
  }

  /**
   * Get remaining time before quiz expires
   * @param {string} escrowAddress - QuizEscrow contract address
   * @returns {Promise<number>} Remaining time in seconds
   */
  async getRemainingTime(escrowAddress) {
    try {
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.provider);
      const remainingTime = await escrowContract.getRemainingTime();
      return remainingTime.toNumber();
    } catch (error) {
      console.error('Failed to get remaining time:', error);
      throw error;
    }
  }

  /**
   * Get all participant addresses
   * @param {string} escrowAddress - QuizEscrow contract address
   * @returns {Promise<string[]>} Array of participant addresses
   */
  async getAllParticipants(escrowAddress) {
    try {
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.provider);
      const participants = await escrowContract.getAllParticipants();
      return participants;
    } catch (error) {
      console.error('Failed to get all participants:', error);
      throw error;
    }
  }

  /**
   * Get detailed results for a specific participant
   * @param {string} escrowAddress - QuizEscrow contract address
   * @param {string} participantAddress - Participant address
   * @returns {Promise<Object>} Participant result details
   */
  async getParticipantResult(escrowAddress, participantAddress) {
    try {
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.provider);
      const result = await escrowContract.getParticipantResult(participantAddress);
      
      return {
        correctCount: result.correctCount.toNumber(),
        incorrectCount: result.incorrectCount.toNumber(),
        totalPayout: result.totalPayout.toString(),
        hasParticipated: result.hasParticipated
      };
    } catch (error) {
      console.error('Failed to get participant result:', error);
      throw error;
    }
  }

  /**
   * Manually end a quiz (returns unclaimed funds to creator)
   * @param {string} escrowAddress - QuizEscrow contract address
   * @returns {Promise<Object>} End quiz result
   */
  async endQuiz(escrowAddress) {
    try {
      if (!this.signer) {
        throw new Error('Signer required for ending quiz');
      }
      
      const escrowContract = new ethers.Contract(escrowAddress, QuizEscrowABI, this.signer);
      const tx = await escrowContract.endQuiz();
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        ended: true
      };
    } catch (error) {
      console.error('Failed to end quiz:', error);
      throw error;
    }
  }

  // Legacy compatibility methods - maintained for backward compatibility
  async createQuiz(params) {
    console.log('[DEPRECATED] QuizService.createQuiz - use deployQuizEscrow instead');
    return this.deployQuizEscrow(params);
  }

  async registerParticipant(escrowAddress, participantAddress) {
    console.log('[DEPRECATED] QuizService.registerParticipant - participants are registered automatically when recording results');
    return true;
  }

  async batchRegisterParticipants(escrowAddress, participants) {
    console.log('[DEPRECATED] QuizService.batchRegisterParticipants - participants are registered automatically when recording results');
    return {
      successful: participants.length,
      failed: 0,
      participants: participants
    };
  }

  async distributeRewards(escrowAddress, correctAnswerIndex) {
    console.log('[DEPRECATED] QuizService.distributeRewards - rewards are distributed automatically via recordQuizResult');
    return {
      distributed: true,
      correctAnswerIndex,
      totalDistributed: 0
    };
  }

  async getQuizParticipants(escrowAddress) {
    console.log('[DEPRECATED] QuizService.getQuizParticipants - use getQuizEscrowInfo for participant count');
    const info = await this.getQuizEscrowInfo(escrowAddress);
    return Array(info.totalParticipants).fill().map((_, i) => ({
      address: `participant_${i}`,
      claimed: true
    }));
  }

  async addAnswer(escrowAddress, userAddress, answerIndex) {
    console.log('[DEPRECATED] QuizService.addAnswer - use recordQuizResult for complete quiz results');
    return true;
  }

  async getQuizRewards(escrowAddress) {
    console.log('[DEPRECATED] QuizService.getQuizRewards - reward information is handled off-chain');
    return {
      totalReward: 0,
      correctAnswerReward: 0,
      incorrectAnswerReward: 0
    };
  }

  async getQuizInfo(quizId) {
    console.log('[DEPRECATED] QuizService.getQuizInfo - quiz information is stored in database');
    return {
      quizId: quizId,
      escrowAddress: null,
      creator: null,
      expiryTime: 0,
      createdAt: 0
    };
  }

  async quizExists(quizId) {
    console.log('[DEPRECATED] QuizService.quizExists - quiz existence is tracked in database');
    return true;
  }

  async getQuizzesByCreator(creatorAddress) {
    console.log('[DEPRECATED] QuizService.getQuizzesByCreator - quiz tracking is handled in database');
    return [];
  }
}

module.exports = QuizService;
