/**
 * @fileoverview Database integration layer for simulation scripts
 * 
 * Handles updating database models during contract deployment and quiz lifecycle simulation.
 * Uses the same database models as the Discord bot for consistency.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

/**
 * SimulationDatabaseManager - Handles database operations during simulation
 * Simplified in-memory version for contract testing focus
 */
class SimulationDatabaseManager {
  constructor() {
    this.isInitialized = false;
    this.mockData = {
      users: new Map(),
      quizzes: new Map(),
      walletMappings: new Map(),
      transactions: []
    };
  }

  /**
   * Initialize database connection (simplified for simulation)
   */
  async initialize() {
    try {
      console.log('SimulationDB: Initializing in-memory database stub...');
      
      // Simulate database initialization
      this.isInitialized = true;
      console.log('SimulationDB: In-memory database ready for simulation');
      
      return {
        success: true,
        message: 'Database stub initialized successfully'
      };
    } catch (error) {
      console.error('SimulationDB: Failed to initialize database:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create or update user record
   */
  async createUser(discordId, walletAddress, accountKitData = {}) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const user = {
      discordId,
      walletAddress,
      accountKitData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockData.users.set(discordId, user);
    console.log(`SimulationDB: Created user ${discordId} with wallet ${walletAddress}`);
    
    return user;
  }

  /**
   * Create a new quiz in the database
   */
  async createQuiz(quizData) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const quiz = {
      id: quizData.id, // Use the provided ID
      quizId: quizData.id, // Also store as quizId for compatibility
      creatorDiscordId: quizData.creatorDiscordId,
      creatorWalletAddress: quizData.creatorWalletAddress,
      sourceUrl: quizData.sourceUrl,
      difficulty: quizData.difficulty,
      questionCount: quizData.questionCount,
      tokenAddress: quizData.tokenAddress,
      chainId: quizData.chainId,
      rewardAmount: quizData.rewardAmount,
      contractAddress: quizData.contractAddress || null,
      status: 'active',
      createdAt: new Date(),
      participants: []
    };

    this.mockData.quizzes.set(quiz.id, quiz);
    console.log(`SimulationDB: Created quiz ${quiz.id} at contract ${quiz.contractAddress}`);
    
    return quiz;
  }

  /**
   * Record quiz participation and result
   */
  async recordQuizResult(quizId, userId, correctCount, incorrectCount, rewardAmount) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const quiz = this.mockData.quizzes.get(quizId);
    if (!quiz) {
      throw new Error(`Quiz ${quizId} not found`);
    }

    const result = {
      userId,
      correctCount,
      incorrectCount,
      rewardAmount,
      recordedAt: new Date()
    };

    quiz.participants.push(result);
    console.log(`SimulationDB: Recorded result for ${userId} on quiz ${quizId}: ${correctCount}C/${incorrectCount}I, reward: ${rewardAmount}`);
    
    return result;
  }

  /**
   * Create question for quiz (simulation stub)
   */
  async createQuestion(questionData) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const question = {
      id: questionData.id,
      quizId: questionData.quizId,
      questionText: questionData.questionText,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation || 'Simulated question explanation',
      createdAt: new Date()
    };

    console.log(`SimulationDB: Created question ${question.id} for quiz ${questionData.quizId}`);
    return question;
  }

  /**
   * Submit answer for user (simulation stub)
   */
  async submitAnswer(answerData) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const answer = {
      id: `answer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quizId: answerData.quizId,
      questionId: answerData.questionId,
      userDiscordId: answerData.userDiscordId,
      userWalletAddress: answerData.userWalletAddress,
      selectedOptionIndex: answerData.selectedOptionIndex,
      isCorrect: answerData.isCorrect,
      answeredAt: new Date(),
      onChain: false
    };

    console.log(`SimulationDB: Submitted answer for user ${answerData.userDiscordId} - ${answer.isCorrect ? 'Correct' : 'Incorrect'}`);
    return answer;
  }

  /**
   * Update quiz with deployment information (simulation stub)
   */
  async updateQuizDeployment(quizId, deploymentData) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const quiz = this.mockData.quizzes.get(quizId);
    if (!quiz) {
      throw new Error(`Quiz ${quizId} not found`);
    }

    quiz.escrowAddress = deploymentData.escrowAddress;
    quiz.transactionHash = deploymentData.transactionHash;
    quiz.onChain = true;
    quiz.expiryTime = deploymentData.expiryTime;
    quiz.fundingStatus = 'funded';

    console.log(`SimulationDB: Updated quiz ${quizId} with deployment data - contract: ${deploymentData.escrowAddress}`);
    return quiz;
  }

  /**
   * Update answer with blockchain transaction data (simulation stub)
   */
  async updateAnswerOnChain(answerId, transactionHash) {
    console.log(`SimulationDB: Updated answer ${answerId} with transaction ${transactionHash}`);
    return {
      id: answerId,
      transactionHash,
      onChain: true,
      updatedAt: new Date()
    };
  }

  /**
   * Get quiz statistics (simulation stub)
   */
  async getQuizStats(quizId) {
    const quiz = this.mockData.quizzes.get(quizId);
    if (!quiz) return null;

    return {
      quizId,
      totalParticipants: quiz.participants.length,
      correctAnswers: quiz.participants.reduce((sum, p) => sum + p.correctCount, 0),
      incorrectAnswers: quiz.participants.reduce((sum, p) => sum + p.incorrectCount, 0),
      onChainAnswers: quiz.participants.length, // All simulated as on-chain
      quiz: quiz,
      answers: quiz.participants
    };
  }

  /**
   * Upsert wallet mapping for Discord user (simulation stub)
   */
  async upsertWalletMapping(discordId, walletAddress) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const mapping = {
      discordId,
      walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      verified: true // Simulated as verified
    };

    console.log(`SimulationDB: Mapped Discord user ${discordId} to wallet ${walletAddress}`);
    return mapping;
  }

  /**
   * Record blockchain transaction
   */
  async recordTransaction(type, txHash, fromAddress, toAddress, amount, details = {}) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const transaction = {
      type,
      txHash,
      fromAddress,
      toAddress,
      amount,
      details,
      timestamp: new Date()
    };

    this.mockData.transactions.push(transaction);
    console.log(`SimulationDB: Recorded ${type} transaction ${txHash}: ${amount} from ${fromAddress}`);
    
    return transaction;
  }

  /**
   * Get simulation summary
   */
  getSimulationSummary() {
    return {
      totalUsers: this.mockData.users.size,
      totalQuizzes: this.mockData.quizzes.size,
      totalTransactions: this.mockData.transactions.length,
      totalParticipants: Array.from(this.mockData.quizzes.values())
        .reduce((total, quiz) => total + quiz.participants.length, 0)
    };
  }

  /**
   * Reset simulation data
   */
  reset() {
    this.mockData = {
      users: new Map(),
      quizzes: new Map(), 
      walletMappings: new Map(),
      transactions: []
    };
    console.log('SimulationDB: Reset all simulation data');
  }

  /**
   * Close database connection (no-op for simulation)
   */
  async close() {
    console.log('SimulationDB: Closing database connection (simulation stub)');
    this.isInitialized = false;
  }
}

module.exports = { SimulationDatabaseManager };
