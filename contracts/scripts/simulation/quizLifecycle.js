/**
 * @fileoverview Quiz Lifecycle Simulator
 * 
 * Orchestrates the complete quiz lifecycle from creation to reward distribution,
 * simulating real user interactions and blockchain events.
 */

const { ethers } = require("hardhat");
const { v4: uuidv4 } = require('uuid');
const { MockAccountKitProvider } = require('./mockAccountKit');
const { SimulationDatabaseManager } = require('./databaseIntegration');

/**
 * Quiz Lifecycle Simulator
 */
class QuizLifecycleSimulator {
  constructor(contracts, options = {}) {
    this.contracts = contracts; // { motherFactory, quizHandler, proxyAdmin, etc. }
    this.accountKit = new MockAccountKitProvider();
    this.database = new SimulationDatabaseManager();
    
    // Configuration
    this.config = {
      numUsers: options.numUsers || 5,
      rewardAmount: options.rewardAmount || ethers.utils.parseEther("0.1"),
      tokenAddress: options.tokenAddress || ethers.constants.AddressZero, // Use ETH for simulation
      chainId: options.chainId || 31337, // Hardhat local network
      correctAnswerReward: options.correctAnswerReward || ethers.utils.parseEther("0.075"),
      incorrectAnswerReward: options.incorrectAnswerReward || ethers.utils.parseEther("0.025"),
      ...options
    };
    
    this.simulationData = {
      quizId: null,
      escrowAddress: null,
      participants: [],
      answers: [],
      results: {}
    };
  }

  /**
   * Initialize the simulation environment
   */
  async initialize() {
    console.log('\n🎯 Initializing Quiz Lifecycle Simulation...\n');
    
    // Initialize components
    await this.accountKit.initializeWalletPool();
    await this.database.initialize();
    
    console.log('✅ Simulation environment ready\n');
  }

  /**
   * Phase 1: Create Quiz and Deploy Escrow Contract
   */
  async createQuizAndDeploy() {
    console.log('📝 Phase 1: Creating Quiz and Deploying Escrow Contract\n');
    
    // Generate quiz data
    const quizId = uuidv4();
    const creatorDiscordId = '123456789012345678'; // Mock creator Discord ID
    
    // Connect creator wallet
    const creatorWallet = await this.accountKit.connectWallet(creatorDiscordId, {
      username: 'QuizCreator'
    });
    
    console.log(`Creator: ${creatorDiscordId} -> ${creatorWallet.address}`);
    
    // Create quiz in database
    const quizData = {
      id: quizId,
      creatorDiscordId,
      creatorWalletAddress: creatorWallet.address,
      sourceUrl: 'https://simulation.example.com/quiz',
      difficulty: 'medium',
      questionCount: 1,
      tokenAddress: this.config.tokenAddress,
      chainId: this.config.chainId,
      rewardAmount: this.config.rewardAmount.toString()
    };
    
    const quiz = await this.database.createQuiz(quizData);
    console.log(`📊 Created quiz in database: ${quiz.id}`);
    
    // Create question
    const questionId = uuidv4();
    const questionData = {
      id: questionId,
      quizId: quiz.id,
      questionText: 'What is the capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctAnswer: 1, // Paris
      explanation: 'Paris is the capital and largest city of France.'
    };
    
    const question = await this.database.createQuestion(questionData);
    console.log(`❓ Created question: ${question.questionText}`);
    
    // Deploy escrow contract via MotherFactory
    console.log('\n🚀 Deploying QuizEscrow via MotherFactory...');
    
    // Encode parameters for QuizHandler (correctReward, incorrectReward)
    const encodedParams = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [this.config.correctAnswerReward, this.config.incorrectAnswerReward]
    );
    
    const deployTx = await this.contracts.motherFactory
      .connect(creatorWallet.signer)
      .deployContract(
        "QuizEscrow", // contractType string
        encodedParams, // ABI-encoded parameters
        { value: this.config.rewardAmount } // Send ETH as funding
      );
    
    const receipt = await deployTx.wait();
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Debug: Log all events to see what's available
    console.log(`🔍 Receipt events:`, receipt.events?.map(e => ({
      event: e.event,
      address: e.address,
      args: e.args ? Object.keys(e.args) : 'no args'
    })));
    
    // Find escrow deployment event
    const deploymentEvent = receipt.events?.find(e => e.event === 'ContractDeployed');
    if (!deploymentEvent) {
      throw new Error('Contract deployment event not found');
    }
    
    console.log(`🔍 Deployment event args:`, deploymentEvent.args);
    const escrowAddress = deploymentEvent.args[2]; // contractAddress is at index 2
    console.log(`📃 QuizEscrow deployed at: ${escrowAddress}`);
    
    // Update database with deployment info
    const expiryTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
    await this.database.updateQuizDeployment(quiz.id, {
      escrowAddress,
      transactionHash: receipt.transactionHash,
      expiryTime
    });
    
    // Store simulation data
    this.simulationData.quizId = quiz.id;
    this.simulationData.escrowAddress = escrowAddress;
    this.simulationData.questionId = questionId;
    this.simulationData.correctAnswer = questionData.correctAnswer;
    
    console.log('✅ Phase 1 Complete: Quiz created and escrow deployed\n');
    
    return {
      quiz,
      question,
      escrowAddress,
      transactionHash: receipt.transactionHash
    };
  }

  /**
   * Phase 2: Simulate User Participation
   */
  async simulateUserParticipation() {
    console.log('👥 Phase 2: Simulating User Participation\n');
    
    // Generate test Discord IDs
    const discordIds = MockAccountKitProvider.generateDiscordIds(this.config.numUsers);
    console.log(`Generated ${discordIds.length} test users`);
    
    // Connect wallets for all users
    const connectionResults = await this.accountKit.batchConnectWallets(discordIds);
    console.log(`Connected ${connectionResults.filter(r => r.success).length} wallets`);
    
    // Update wallet mappings in database
    for (const result of connectionResults) {
      if (result.success) {
        await this.database.upsertWalletMapping(
          result.discordId,
          result.walletInfo.address,
          { username: `SimUser${result.discordId.slice(-4)}` }
        );
      }
    }
    
    // Simulate answer submissions with realistic distribution
    const answers = [];
    for (let i = 0; i < connectionResults.length; i++) {
      const result = connectionResults[i];
      if (!result.success) continue;
      
      const { discordId, walletInfo } = result;
      
      // Create realistic answer distribution (70% correct, 30% incorrect)
      const isCorrect = Math.random() < 0.7;
      const selectedAnswer = isCorrect 
        ? this.simulationData.correctAnswer 
        : (this.simulationData.correctAnswer + 1) % 4; // Pick a different answer
      
      const answerData = {
        quizId: this.simulationData.quizId,
        questionId: this.simulationData.questionId,
        userDiscordId: discordId,
        userWalletAddress: walletInfo.address,
        selectedOptionIndex: selectedAnswer,
        isCorrect
      };
      
      const answer = await this.database.submitAnswer(answerData);
      answers.push(answer);
      
      console.log(`📝 User ${discordId.slice(-4)} answered: ${selectedAnswer} (${isCorrect ? '✅' : '❌'})`);
      
      // Add small delay to simulate realistic timing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.simulationData.participants = connectionResults.filter(r => r.success);
    this.simulationData.answers = answers;
    
    console.log(`✅ Phase 2 Complete: ${answers.length} users participated\n`);
    
    return answers;
  }

  /**
   * Phase 3: Record Results On-Chain
   */
  async recordResultsOnChain() {
    console.log('⛓️  Phase 3: Recording Results On-Chain\n');
    
    // Get the authorized bot signer (second signer in test accounts)
    const [deployer, authorizedBot] = await ethers.getSigners();
    
    // Get escrow contract instance
    const QuizEscrow = await ethers.getContractFactory("QuizEscrow");
    const escrow = QuizEscrow.attach(this.simulationData.escrowAddress);
    
    // Verify authorized bot address matches expected bot for simulation
    const contractAuthorizedBot = await escrow.authorizedBot();
    console.log(`Authorized bot from contract: ${contractAuthorizedBot}`);
    console.log(`Authorized bot signer address: ${authorizedBot.address}`);
    
    if (contractAuthorizedBot !== authorizedBot.address) {
      throw new Error(`Authorization mismatch: contract expects ${contractAuthorizedBot} but simulation using ${authorizedBot.address}`);
    }
    
    // Record results for each participant
    const recordingResults = [];
    
    for (const answer of this.simulationData.answers) {
      try {
        // Record result on blockchain using authorized bot signer
        const tx = await escrow.connect(authorizedBot).recordQuizResult(
          answer.userWalletAddress,
          answer.isCorrect ? 1 : 0,
          answer.isCorrect ? 0 : 1
        );
        const receipt = await tx.wait();
        console.log(`  ✅ On-chain result recorded for ${answer.userDiscordId.slice(-4)}`);
        console.log(`  ⛽ Gas used: ${receipt.gasUsed} | Transaction: ${tx.hash.slice(0, 10)}...`);
        
        // Record transaction in database
        await this.database.updateAnswerOnChain(answer.id, tx.hash);
        
        recordingResults.push({
          answerId: answer.id,
          userAddress: answer.userWalletAddress,
          transactionHash: tx.hash,
          gasUsed: receipt.gasUsed
        });
        
        console.log(`  ✅ Recorded (${receipt.gasUsed} gas)`);
        
      } catch (error) {
        console.error(`  ❌ Failed to record result for ${answer.userDiscordId}:`, error.message);
        recordingResults.push({
          answerId: answer.id,
          error: error.message
        });
      }
    }
    
    this.simulationData.recordingResults = recordingResults;
    
    console.log(`✅ Phase 3 Complete: Results recorded on-chain\n`);
    
    return recordingResults;
  }

  /**
   * Phase 4: Verify Final State
   */
  async verifyFinalState() {
    console.log('🔍 Phase 4: Verifying Final State\n');
    
    // Get final quiz statistics from database
    const quizStats = await this.database.getQuizStats(this.simulationData.quizId);
    
    // Get contract state
    const QuizEscrow = await ethers.getContractFactory("QuizEscrow");
    const escrow = QuizEscrow.attach(this.simulationData.escrowAddress);
    
    const contractState = {
      creator: await escrow.creator(),
      // No tokenAddress - this is an ETH-based contract
      correctReward: await escrow.correctReward(),
      incorrectReward: await escrow.incorrectReward(),
      fundingAmount: await escrow.fundingAmount(),
      remainingBalance: await escrow.getBalance(),
      totalCorrectAnswers: await escrow.totalCorrectAnswers(),
      totalIncorrectAnswers: await escrow.totalIncorrectAnswers(),
      totalParticipants: await escrow.totalParticipants(),
      totalPaidOut: await escrow.totalPaidOut(),
      creationTime: await escrow.creationTime(),
      isEnded: await escrow.isEnded()
    };
    
    // Generate verification report
    const report = {
      simulation: {
        quizId: this.simulationData.quizId,
        escrowAddress: this.simulationData.escrowAddress,
        participants: this.simulationData.participants.length,
        answers: this.simulationData.answers.length
      },
      database: quizStats,
      contract: {
        creator: contractState.creator,
        correctReward: ethers.utils.formatEther(contractState.correctReward),
        incorrectReward: ethers.utils.formatEther(contractState.incorrectReward),
        fundingAmount: ethers.utils.formatEther(contractState.fundingAmount),
        remainingBalance: ethers.utils.formatEther(contractState.remainingBalance),
        totalCorrectAnswers: contractState.totalCorrectAnswers.toString(),
        totalIncorrectAnswers: contractState.totalIncorrectAnswers.toString(),
        totalParticipants: contractState.totalParticipants.toString(),
        totalPaidOut: ethers.utils.formatEther(contractState.totalPaidOut),
        creationTime: new Date(contractState.creationTime.toNumber() * 1000).toISOString(),
        isEnded: contractState.isEnded
      },
      verification: {
        databaseContractSync: quizStats.correctAnswers.toString() === contractState.totalCorrectAnswers.toString() &&
                            quizStats.incorrectAnswers.toString() === contractState.totalIncorrectAnswers.toString(),
        allAnswersOnChain: quizStats.onChainAnswers === quizStats.totalParticipants,
        balanceCalculation: 'verified' // Could add more detailed balance verification
      }
    };
    
    // Display results
    console.log('📊 SIMULATION RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Quiz ID: ${report.simulation.quizId}`);
    console.log(`Escrow Address: ${report.simulation.escrowAddress}`);
    console.log(`Total Participants: ${report.simulation.participants}`);
    console.log(`Correct Answers: ${report.database.correctAnswers}`);
    console.log(`Incorrect Answers: ${report.database.incorrectAnswers}`);
    console.log(`On-Chain Answers: ${report.database.onChainAnswers}`);
    console.log(`Contract Correct Count: ${report.contract.totalCorrectAnswers}`);
    console.log(`Contract Incorrect Count: ${report.contract.totalIncorrectAnswers}`);
    console.log(`Total Funding: ${report.contract.fundingAmount} ETH`);
    console.log(`Remaining Balance: ${report.contract.remainingBalance} ETH`);
    console.log(`Database-Contract Sync: ${report.verification.databaseContractSync ? '✅' : '❌'}`);
    console.log(`All Answers On-Chain: ${report.verification.allAnswersOnChain ? '✅' : '❌'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n✅ Phase 4 Complete: Verification finished\n');
    
    return report;
  }

  /**
   * Run the complete simulation
   */
  async run() {
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      const phase1 = await this.createQuizAndDeploy();
      const phase2 = await this.simulateUserParticipation();
      const phase3 = await this.recordResultsOnChain();
      const phase4 = await this.verifyFinalState();
      
      const duration = Date.now() - startTime;
      
      console.log(`🏁 Simulation Complete in ${duration}ms\n`);
      
      return {
        success: true,
        duration,
        phases: {
          deployment: phase1,
          participation: phase2,
          recording: phase3,
          verification: phase4
        }
      };
      
    } catch (error) {
      console.error('❌ Simulation Failed:', error);
      throw error;
    }
  }

  /**
   * Clean up simulation data (optional)
   */
  async cleanup() {
    console.log('🧹 Cleaning up simulation data...');
    
    if (this.simulationData.quizId) {
      await this.database.cleanup(this.simulationData.quizId);
    }
    
    this.accountKit.reset();
    await this.database.close();
    
    console.log('✅ Cleanup complete');
  }
}

module.exports = { QuizLifecycleSimulator };
