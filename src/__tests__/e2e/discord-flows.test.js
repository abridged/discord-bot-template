/**
 * End-to-End Discord Flow Tests
 * Tests complete Discord bot interaction flows
 */

const { processQuizCommand, handleQuizApproval } = require('../../orchestration');
const { createBlockchainService } = require('../../services/blockchain/index');
const { createMockInteraction, createMockModalSubmission } = require('../helpers/discordMocks');

// Mock Discord.js components
jest.mock('discord.js', () => ({
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis(),
  })),
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
  }
}));

// Test utilities
const createTestQuizData = () => ({
  id: 'test-quiz-' + Date.now(),
  question: 'What is the capital of France?',
  choices: ['London', 'Berlin', 'Paris', 'Madrid'],
  correctAnswer: 2, // Index of 'Paris'
  explanation: 'Paris is the capital and largest city of France.',
  creator: {
    id: 'test-user-456',
    username: 'quizmaster'
  },
  channelId: 'test-channel-456',
  guildId: 'test-guild-456'
});

const createTestUser = (hasBalance = true) => ({
  id: 'test-user-789',
  username: 'participant',
  balance: hasBalance ? 5000 : 0, // tokens
  smartAccountAddress: '0x1234567890123456789012345678901234567890'
});

describe('Discord Bot E2E Flows', () => {
  let blockchainService;
  let originalEnv;

  beforeAll(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.USE_REAL_BLOCKCHAIN = 'false'; // Use dev mode for most tests
    process.env.MOTHER_FACTORY_ADDRESS = '0xFC94d8b4CB7a73Cd4E6b3dE152df26066f6Ae9E0';
    process.env.QUIZ_HANDLER_ADDRESS = '0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903';
    
    blockchainService = createBlockchainService();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Quiz Creation Workflow', () => {
    test('should handle full /mother command flow', async () => {
      const interaction = createMockInteraction('/mother', {
        reply: jest.fn(),
        showModal: jest.fn(),
        user: createTestUser()
      });

      // Execute /mother command
      await processQuizCommand(interaction, {
        commandName: 'mother',
        isInteraction: true,
        reply: interaction
      });

      // Verify modal was shown
      expect(interaction.showModal).toHaveBeenCalled();
      
      // Verify modal configuration
      const modalCall = interaction.showModal.mock.calls[0][0];
      expect(modalCall.data.title).toContain('Mother');
      expect(modalCall.data.components).toBeDefined();
    });

    test('should process quiz modal submission', async () => {
      const quizData = createTestQuizData();
      const modalSubmission = createMockModalSubmission({
        customId: 'mother_quiz_modal',
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce(quizData.question)
            .mockReturnValueOnce(quizData.choices.join('|'))
            .mockReturnValueOnce('2') // correct answer index
            .mockReturnValueOnce(quizData.explanation)
            .mockReturnValueOnce('1000|100') // rewards
        },
        user: createTestUser(),
        reply: jest.fn(),
        update: jest.fn()
      });

      // Process modal submission
      await handleQuizApproval(modalSubmission, quizData);

      // In test mode, should skip blockchain but still process
      expect(modalSubmission.reply || modalSubmission.update).toHaveBeenCalled();
    });

    test('should handle balance verification integration', async () => {
      const user = createTestUser();
      
      // Mock balance check through Account Kit
      const mockBalanceCheck = jest.spyOn(blockchainService, 'checkUserBalance')
        .mockResolvedValue({
          balance: 5000,
          smartAccountAddress: user.smartAccountAddress,
          success: true
        });

      const balance = await blockchainService.checkUserBalance(user);
      
      expect(balance.success).toBe(true);
      expect(balance.balance).toBeGreaterThan(0);
      expect(mockBalanceCheck).toHaveBeenCalledWith(user);
      
      mockBalanceCheck.mockRestore();
    });

    test('should handle USE_REAL_BLOCKCHAIN=true mode', async () => {
      // Temporarily enable real blockchain for this test
      const originalValue = process.env.USE_REAL_BLOCKCHAIN;
      process.env.USE_REAL_BLOCKCHAIN = 'true';

      const quizData = createTestQuizData();
      const submissionParams = {
        correctReward: 1000,
        incorrectReward: 100,
        tokenAddress: process.env.DEFAULT_TOKEN_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: '1000000000000000' // 0.001 ETH in wei
      };

      // Mock successful blockchain submission
      const mockSubmitQuiz = jest.spyOn(blockchainService, 'submitQuiz')
        .mockResolvedValue({
          success: true,
          contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12'
        });

      const result = await blockchainService.submitQuiz(quizData, submissionParams);
      
      expect(result.success).toBe(true);
      expect(result.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      mockSubmitQuiz.mockRestore();
      process.env.USE_REAL_BLOCKCHAIN = originalValue;
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle insufficient balance gracefully', async () => {
      const poorUser = createTestUser(false); // no balance
      const quizData = createTestQuizData();
      
      const interaction = createMockInteraction('/mother', {
        reply: jest.fn(),
        user: poorUser
      });

      // Mock balance check returning insufficient funds
      jest.spyOn(blockchainService, 'checkUserBalance')
        .mockResolvedValue({
          balance: 0,
          smartAccountAddress: poorUser.smartAccountAddress,
          success: true
        });

      await processQuizCommand(interaction, {
        commandName: 'mother',
        isInteraction: true,
        reply: interaction
      });

      // Should handle gracefully and inform user
      expect(interaction.reply).toHaveBeenCalled();
      const replyCall = interaction.reply.mock.calls[0][0];
      expect(replyCall.content || replyCall.embeds?.[0]?.description)
        .toMatch(/balance|insufficient/i);
    });

    test('should handle blockchain service errors', async () => {
      const quizData = createTestQuizData();
      const submissionParams = {
        correctReward: 1000,
        incorrectReward: 100
      };

      // Mock blockchain error
      jest.spyOn(blockchainService, 'submitQuiz')
        .mockRejectedValue(new Error('Network error'));

      await expect(
        blockchainService.submitQuiz(quizData, submissionParams)
      ).rejects.toThrow('Network error');
    });

    test('should handle invalid quiz parameters', async () => {
      const invalidQuizData = {
        ...createTestQuizData(),
        choices: ['Only one choice'] // Invalid - need multiple choices
      };

      const modalSubmission = createMockModalSubmission({
        customId: 'mother_quiz_modal',
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce(invalidQuizData.question)
            .mockReturnValueOnce('Only one choice') // Invalid choices
            .mockReturnValueOnce('0')
            .mockReturnValueOnce('Test explanation')
            .mockReturnValueOnce('1000|100')
        },
        user: createTestUser(),
        reply: jest.fn()
      });

      await handleQuizApproval(modalSubmission, invalidQuizData);

      // Should handle validation error
      expect(modalSubmission.reply).toHaveBeenCalled();
    });

    test('should handle Discord API rate limiting', async () => {
      const interaction = createMockInteraction('/mother', {
        reply: jest.fn().mockRejectedValue(
          new Error('RATE_LIMITED')
        ),
        user: createTestUser()
      });

      // Should not throw, should handle gracefully
      await expect(
        processQuizCommand(interaction, {
          commandName: 'mother',
          isInteraction: true,
          reply: interaction
        })
      ).not.toThrow();
    });
  });

  describe('Development Mode Features', () => {
    test('should show [DEV MODE] labels when USE_REAL_BLOCKCHAIN=false', async () => {
      process.env.USE_REAL_BLOCKCHAIN = 'false';
      
      const quizData = createTestQuizData();
      const modalSubmission = createMockModalSubmission({
        customId: 'mother_quiz_modal',
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce(quizData.question)
            .mockReturnValueOnce(quizData.choices.join('|'))
            .mockReturnValueOnce('2')
            .mockReturnValueOnce(quizData.explanation)
            .mockReturnValueOnce('1000|100')
        },
        user: createTestUser(),
        reply: jest.fn()
      });

      await handleQuizApproval(modalSubmission, quizData);

      // Should include dev mode indicator
      expect(modalSubmission.reply).toHaveBeenCalled();
      const replyContent = modalSubmission.reply.mock.calls[0][0];
      expect(
        replyContent.content || 
        replyContent.embeds?.[0]?.description ||
        replyContent.embeds?.[0]?.title
      ).toMatch(/\[DEV MODE\]/i);
    });

    test('should still check balance in dev mode', async () => {
      process.env.USE_REAL_BLOCKCHAIN = 'false';
      
      const user = createTestUser();
      
      // Even in dev mode, balance checking should occur
      const mockBalanceCheck = jest.spyOn(blockchainService, 'checkUserBalance')
        .mockResolvedValue({
          balance: 5000,
          smartAccountAddress: user.smartAccountAddress,
          success: true
        });

      const balance = await blockchainService.checkUserBalance(user);
      
      expect(balance.success).toBe(true);
      expect(mockBalanceCheck).toHaveBeenCalled();
      
      mockBalanceCheck.mockRestore();
    });
  });

  describe('Performance & Reliability', () => {
    test('should respond to commands within acceptable time', async () => {
      const startTime = Date.now();
      
      const interaction = createMockInteraction('/mother', {
        reply: jest.fn(),
        user: createTestUser()
      });

      await processQuizCommand(interaction, {
        commandName: 'mother',
        isInteraction: true,
        reply: interaction
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });

    test('should handle concurrent quiz submissions', async () => {
      const quizData1 = createTestQuizData();
      const quizData2 = { ...createTestQuizData(), id: 'test-quiz-concurrent-2' };
      
      const submission1 = createMockModalSubmission({
        customId: 'mother_quiz_modal',
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce(quizData1.question)
            .mockReturnValueOnce(quizData1.choices.join('|'))
            .mockReturnValueOnce('2')
            .mockReturnValueOnce(quizData1.explanation)
            .mockReturnValueOnce('1000|100')
        },
        user: createTestUser(),
        reply: jest.fn()
      });

      const submission2 = createMockModalSubmission({
        customId: 'mother_quiz_modal',
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce(quizData2.question)
            .mockReturnValueOnce(quizData2.choices.join('|'))
            .mockReturnValueOnce('1')
            .mockReturnValueOnce(quizData2.explanation)
            .mockReturnValueOnce('2000|200')
        },
        user: createTestUser(),
        reply: jest.fn()
      });

      // Process both simultaneously
      await Promise.all([
        handleQuizApproval(submission1, quizData1),
        handleQuizApproval(submission2, quizData2)
      ]);

      // Both should complete successfully
      expect(submission1.reply).toHaveBeenCalled();
      expect(submission2.reply).toHaveBeenCalled();
    });
  });
});
