/**
 * Unit Tests for the /ask Command
 * 
 * These tests cover the functionality of the bot's /ask command,
 * which is responsible for creating token-incentivized quizzes from URLs.
 */

const { askCommand, handleAskCommand, sendEphemeralPreview, handleQuizApproval, handleQuizCancellation, sendError } = require('../../../bot/commands/ask');

// Mock the dependencies
// Mock the orchestration module which is called by the ask command
jest.mock('../../../orchestration', () => ({
  processQuizCommand: jest.fn()
}));

jest.mock('../../../account-kit/walletManagement', () => ({
  getWalletForUser: jest.fn(),
  distributeRewards: jest.fn(),
  validateTransaction: jest.fn()
}));

jest.mock('../../../quiz/secureQuizGenerator', () => ({
  generateSecureQuiz: jest.fn(),
  validateQuizSecurity: jest.fn()
}));

// Mock Discord.js to prevent hanging
jest.mock('discord.js', () => {
  return {
    SlashCommandBuilder: jest.fn(),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
      addComponents: jest.fn().mockReturnThis(),
      components: [{ id: 'button1' }, { id: 'button2' }]
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
      setCustomId: jest.fn().mockReturnThis(),
      setLabel: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis()
    })),
    EmbedBuilder: jest.fn().mockImplementation(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
      title: 'Quiz Preview', // Add these properties for assertion
      description: 'Preview description',
      fields: [
        { name: 'Source', value: 'Test Article' },
        { name: 'Questions', value: '1 questions' },
        { name: 'Question 1', value: 'Test Question 1?' }
      ]
    })),
    ButtonStyle: {
      Success: 1,
      Danger: 4
    }
  };
});

// Mock Discord.js components and interaction
const mockReply = jest.fn().mockResolvedValue({});
const mockUpdate = jest.fn().mockResolvedValue({});
const mockDeferUpdate = jest.fn().mockResolvedValue({});
const mockFollowUp = jest.fn().mockResolvedValue({});
const mockSend = jest.fn().mockResolvedValue({});

// Create a mock interaction object
const mockInteraction = {
  user: { id: 'user123', username: 'TestUser' },
  options: {
    getString: jest.fn(),
    getInteger: jest.fn()
  },
  reply: mockReply,
  followUp: mockFollowUp,
  channel: {
    send: mockSend
  },
  client: {
    deployQuizContract: jest.fn().mockResolvedValue({
      address: '0xMockContractAddress',
      chainId: 8453
    }),
    quizzes: new Map()
  }
};

// Import the orchestration module to mock it in tests
const { processQuizCommand } = require('../../../orchestration');

describe('Ask Command', () => {
  // Set up fake timers for the entire test suite
  beforeAll(() => {
    jest.useFakeTimers();
  });
  
  afterAll(() => {
    jest.useRealTimers();
  });
  
  beforeEach(() => {
    // Reset mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    
    // Set up default mock responses
    mockInteraction.options.getString.mockImplementation((name) => {
      if (name === 'url') return 'https://example.com/article';
      if (name === 'token') return '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1';
      return null;
    });
    
    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'amount') return 10000;
      if (name === 'chain') return 8453;
      return null;
    });
    
    // Set up mock orchestration response
    processQuizCommand.mockResolvedValue({
      success: true,
      quiz: {
        sourceTitle: 'Test Article',
        sourceUrl: 'https://example.com/article',
        questions: [{
          question: 'Test Question 1?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0
        }]
      }
    });
  });
  
  afterEach(() => {
    // Ensure all timers are cleared
    jest.clearAllTimers();
    // Clean up any other resources
    jest.clearAllMocks();
    // Run any pending timers to resolve promises
    jest.runOnlyPendingTimers();
  });
  
  //--------------------------------------------------------------
  // Basic Command Functionality
  //--------------------------------------------------------------
  describe('Basic Functionality', () => {
    test('should process command options when invoked', async () => {
      await handleAskCommand(mockInteraction);
      
      // Should call processQuizCommand with expected parameters
      expect(processQuizCommand).toHaveBeenCalledWith({
        url: 'https://example.com/article',
        token: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
        chain: 8453,
        amount: 10000,
        userId: 'user123'
      });
    });
    
    test('should send ephemeral preview on success', async () => {
      await handleAskCommand(mockInteraction);
      
      // Should send an ephemeral message with a preview
      expect(mockReply).toHaveBeenCalled();
      expect(mockReply.mock.calls[0][0].ephemeral).toBe(true);
    });
  });
  
  //--------------------------------------------------------------
  // Error Handling
  //--------------------------------------------------------------
  describe('Error Handling', () => {
    test('should handle orchestration errors', async () => {
      // Mock failure response
      processQuizCommand.mockResolvedValueOnce({
        success: false,
        error: 'Failed to process URL'
      });
      
      await handleAskCommand(mockInteraction);
      
      // Should display error message
      expect(mockReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Error creating quiz'),
        ephemeral: true
      });
    });
    
    test('should handle unexpected errors', async () => {
      // Mock an error being thrown
      processQuizCommand.mockRejectedValueOnce(new Error('Unexpected error'));
      
      await handleAskCommand(mockInteraction);
      
      // Should display error message
      expect(mockReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Error creating quiz'),
        ephemeral: true
      });
    });
  });
  
  //--------------------------------------------------------------
  // Quiz Interaction Flow
  //--------------------------------------------------------------
  describe('Quiz Interaction Flow', () => {
    test('should create preview with confirmation buttons', async () => {
      const quizData = {
        sourceTitle: 'Test Article',
        sourceUrl: 'https://example.com/article',
        questions: [{ question: 'Test Question 1?', options: ['A', 'B', 'C', 'D'] }]
      };
      
      await sendEphemeralPreview(mockInteraction, quizData);
      
      // Verify the reply was called with correct parameters
      expect(mockReply).toHaveBeenCalled();
      const callArgs = mockReply.mock.calls[0][0];
      
      // Verify it has embeds and components
      expect(callArgs.embeds).toBeDefined();
      expect(callArgs.components).toBeDefined();
      expect(callArgs.ephemeral).toBe(true);
    });
    
    test('should handle quiz approval correctly', async () => {
      // Create mock button interaction
      const buttonInteraction = {
        customId: 'approve_quiz_user123_123', // Include user ID to pass auth check
        user: { id: 'user123' },
        channel: { send: mockSend },
        client: {
          deployQuizContract: jest.fn().mockResolvedValue({
            address: '0xMockContractAddress',
            chainId: 8453
          })
        },
        update: mockUpdate,
        deferUpdate: mockDeferUpdate
      };
      
      // Create quiz data
      const quizData = {
        sourceTitle: 'Test Article',
        sourceUrl: 'https://example.com/article',
        questions: [{ question: 'Test?', options: ['A', 'B'] }]
      };
      
      // Silence console errors
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Test the approval handler
        await handleQuizApproval(buttonInteraction, quizData);
        
        // Should update the interaction
        expect(buttonInteraction.update).toHaveBeenCalled();
        // Message should contain info about deployment
        expect(buttonInteraction.update.mock.calls[0][0].content).toContain('Creating quiz contract');
      } finally {
        consoleSpy.mockRestore();
      }
    });
    
    test('should handle quiz cancellation', async () => {
      // Create button interaction for cancellation
      const buttonInteraction = {
        customId: 'cancel_quiz_123',
        user: { id: 'user123' },
        update: mockUpdate
      };
      
      // Test cancellation
      await handleQuizCancellation(buttonInteraction);
      
      // Should update with cancellation message
      expect(buttonInteraction.update).toHaveBeenCalled();
      expect(buttonInteraction.update.mock.calls[0][0].content).toContain('cancelled');
    });
  });
  
  //--------------------------------------------------------------
  // Security and Error Handling
  //--------------------------------------------------------------
  describe('Security and Error Handling', () => {
    test('should handle errors during quiz approval', async () => {
      // Create button interaction that throws an error on update
      const buttonInteraction = {
        customId: 'approve_quiz_user123_123', // Include user ID to pass auth check
        user: { id: 'user123' },
        channel: { send: mockSend },
        client: {
          deployQuizContract: jest.fn().mockResolvedValue({
            address: '0xMockContractAddress',
            chainId: 8453
          })
        },
        update: jest.fn().mockImplementation(() => {
          throw new Error('Update failed');
        }),
        deferUpdate: mockDeferUpdate
      };
      
      // Create quiz data
      const quizData = {
        sourceTitle: 'Test Article',
        sourceUrl: 'https://example.com/article',
        questions: [{ question: 'Test?', options: ['A', 'B'] }]
      };
      
      // Silence console errors
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Should not throw when handling error
        await expect(handleQuizApproval(buttonInteraction, quizData)).resolves.not.toThrow();
      } finally {
        consoleSpy.mockRestore();
      }
    });
    
    test('should handle interaction token expiration', async () => {
      // Create button interaction that throws a token expiration error
      const buttonInteraction = {
        customId: 'approve_quiz_user123_123', // Include user ID to pass auth check
        user: { id: 'user123' },
        channel: { send: mockSend },
        client: {
          deployQuizContract: jest.fn().mockResolvedValue({
            address: '0xMockContractAddress',
            chainId: 8453
          })
        },
        update: jest.fn().mockImplementation(() => {
          const error = new Error('Interaction token expired');
          error.code = 40060; // INTERACTION_TIMEOUT
          throw error;
        }),
        deferUpdate: mockDeferUpdate
      };
      
      // Create quiz data
      const quizData = {
        sourceTitle: 'Test Article',
        sourceUrl: 'https://example.com/article',
        questions: [{ question: 'Test?', options: ['A', 'B'] }]
      };
      
      // Silence console errors
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Should handle the token expiration gracefully
        await expect(handleQuizApproval(buttonInteraction, quizData)).resolves.not.toThrow();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
