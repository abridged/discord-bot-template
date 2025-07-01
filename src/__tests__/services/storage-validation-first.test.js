/**
 * Storage Service Validation-First Flow Tests
 * 
 * Tests that verify the critical validation-first flow:
 * 1. Blockchain validation happens BEFORE database save
 * 2. Zero-funding quizzes still require blockchain validation 
 * 3. Missing MotherFactory/QuizEscrow contracts block quiz creation
 * 4. No inconsistent database states from partial failures
 */

const storageService = require('../../services/storage');

// Mock dependencies
jest.mock('../../services/blockchain', () => ({
  submitQuiz: jest.fn()
}));

jest.mock('../../database/models', () => ({
  Quiz: {
    findByPk: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('../../repositories/quiz.repository', () => ({
  createQuizRepository: jest.fn(() => ({
    saveQuiz: jest.fn(),
    getQuiz: jest.fn()
  }))
}));

jest.mock('../../database/setup', () => ({
  setupDatabase: jest.fn()
}));

const blockchainService = require('../../services/blockchain');
const models = require('../../database/models');
const { createQuizRepository } = require('../../repositories/quiz.repository');

describe('Storage Service Validation-First Flow', () => {
  let mockQuizRepository;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USE_REAL_BLOCKCHAIN = 'true';
    
    // Create mock repository instance
    mockQuizRepository = {
      saveQuiz: jest.fn().mockResolvedValue('quiz_123'),
      getQuiz: jest.fn()
    };
    
    // Configure mocks
    createQuizRepository.mockReturnValue(mockQuizRepository);
    require('../../database/setup').setupDatabase.mockResolvedValue(true);
    models.Quiz.findByPk.mockResolvedValue(null); // No existing quiz
  });

  afterEach(() => {
    delete process.env.USE_REAL_BLOCKCHAIN;
  });

  describe('Validation-First Flow', () => {
    test('should perform blockchain validation BEFORE database save', async () => {
      // Arrange
      const quizData = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 1000,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      const userWallet = '0x1111111111111111111111111111111111111111';
      
      const blockchainResult = {
        transactionHash: '0xabcd',
        escrowAddress: '0x2222222222222222222222222222222222222222',
        expiryTime: Date.now() + 86400000
      };
      
      blockchainService.submitQuiz.mockResolvedValue(blockchainResult);
      
      // Act
      await storageService.saveQuiz(quizData, userWallet);
      
      // Assert - blockchain validation called BEFORE database save
      expect(blockchainService.submitQuiz).toHaveBeenCalledTimes(1);
      expect(mockQuizRepository.saveQuiz).toHaveBeenCalledTimes(1);
      expect(blockchainService.submitQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          ...quizData,
          id: expect.any(String)
        }),
        userWallet,
        'user123'
      );
      
      // Database save called with blockchain data
      expect(mockQuizRepository.saveQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          escrowAddress: blockchainResult.escrowAddress,
          transactionHash: blockchainResult.transactionHash,
          expiryTime: blockchainResult.expiryTime,
          onChain: true,
          creatorWalletAddress: userWallet
        })
      );
    });

    test('should block database save when blockchain validation fails', async () => {
      // Arrange
      const quizData = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 1000,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      const userWallet = '0x1111111111111111111111111111111111111111';
      
      // Simulate MotherFactory not deployed
      blockchainService.submitQuiz.mockRejectedValue(
        new Error('MotherFactory contract not found at configured address')
      );
      
      // Act & Assert
      await expect(storageService.saveQuiz(quizData, userWallet))
        .rejects
        .toThrow('Quiz creation blocked: MotherFactory contract not found at configured address');
      
      // Database save should NOT be called when blockchain fails
      expect(mockQuizRepository.saveQuiz).not.toHaveBeenCalled();
    });
  });

  describe('Zero-Funding Validation', () => {
    test('should enforce blockchain validation for zero-reward quizzes', async () => {
      // Arrange
      const zeroRewardQuiz = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 0, // Zero funding
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      const userWallet = '0x1111111111111111111111111111111111111111';
      
      blockchainService.submitQuiz.mockResolvedValue({
        transactionHash: '0xabcd',
        escrowAddress: '0x2222222222222222222222222222222222222222',
        expiryTime: Date.now() + 86400000
      });
      
      // Act
      await storageService.saveQuiz(zeroRewardQuiz, userWallet);
      
      // Assert - blockchain validation still enforced for zero reward
      expect(blockchainService.submitQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardAmount: 0
        }),
        userWallet,
        'user123'
      );
    });

    test('should block zero-reward quiz creation when MotherFactory missing', async () => {
      // Arrange
      const zeroRewardQuiz = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 0,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      const userWallet = '0x1111111111111111111111111111111111111111';
      
      // Simulate missing contracts
      blockchainService.submitQuiz.mockRejectedValue(
        new Error('QuizEscrow handler not registered in MotherFactory')
      );
      
      // Act & Assert
      await expect(storageService.saveQuiz(zeroRewardQuiz, userWallet))
        .rejects
        .toThrow('Quiz creation blocked: QuizEscrow handler not registered in MotherFactory');
      
      // No database entry created
      expect(mockQuizRepository.saveQuiz).not.toHaveBeenCalled();
    });
  });

  describe('Missing Contract Scenarios', () => {
    test('should block creation when MotherFactory not deployed', async () => {
      // Arrange
      const quizData = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 1000,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      const userWallet = '0x1111111111111111111111111111111111111111';
      
      blockchainService.submitQuiz.mockRejectedValue(
        new Error('call revert exception; VM Exception while processing transaction: reverted with reason string "Contract not found"')
      );
      
      // Act & Assert
      await expect(storageService.saveQuiz(quizData, userWallet))
        .rejects
        .toThrow('Quiz creation blocked');
      
      expect(mockQuizRepository.saveQuiz).not.toHaveBeenCalled();
    });

    test('should block creation when QuizEscrow implementation missing', async () => {
      // Arrange
      const quizData = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 1000,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      const userWallet = '0x1111111111111111111111111111111111111111';
      
      blockchainService.submitQuiz.mockRejectedValue(
        new Error('Handler implementation address is zero')
      );
      
      // Act & Assert
      await expect(storageService.saveQuiz(quizData, userWallet))
        .rejects
        .toThrow('Quiz creation blocked: Handler implementation address is zero');
      
      expect(mockQuizRepository.saveQuiz).not.toHaveBeenCalled();
    });
  });

  describe('Wallet Validation', () => {
    test('should require valid wallet address for blockchain operations', async () => {
      // Arrange
      const quizData = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 1000,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      
      // Act & Assert - no wallet provided
      await expect(storageService.saveQuiz(quizData, null))
        .rejects
        .toThrow('User wallet address is required for blockchain operations');
      
      // Invalid wallet format
      await expect(storageService.saveQuiz(quizData, 'invalid_wallet'))
        .rejects
        .toThrow('Invalid wallet address format for blockchain operations');
      
      expect(mockQuizRepository.saveQuiz).not.toHaveBeenCalled();
    });
  });

  describe('Development Mode Behavior', () => {
    test('should skip blockchain validation in development mode', async () => {
      // Arrange
      process.env.USE_REAL_BLOCKCHAIN = 'false';
      
      const quizData = {
        creatorDiscordId: 'user123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        rewardAmount: 1000,
        questions: [{ question: 'Test?', answers: ['A', 'B'] }]
      };
      
      // Act
      await storageService.saveQuiz(quizData, null);
      
      // Assert - blockchain service not called in dev mode
      expect(blockchainService.submitQuiz).not.toHaveBeenCalled();
      
      // Database save called with default values
      expect(mockQuizRepository.saveQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          onChain: false,
          creatorWalletAddress: null
        })
      );
    });
  });
});
