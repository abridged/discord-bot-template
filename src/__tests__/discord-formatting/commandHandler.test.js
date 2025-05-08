/**
 * Discord Command Handler Tests
 * 
 * Tests the slash command handling and Discord interactions
 */

// Mock the Discord.js modules
const mockInteractionReply = jest.fn();
const mockButtonInteraction = jest.fn();
const mockEditReply = jest.fn();
const mockFollowUp = jest.fn();
const mockChannelSend = jest.fn();

jest.mock('discord.js', () => {
  // Create proper mock implementations that maintain component structure
  const createButtonBuilder = () => {
    const button = {
      customId: '',
      label: '',
      style: 1,
      setCustomId: function(id) { this.customId = id; return this; },
      setLabel: function(label) { this.label = label; return this; },
      setStyle: function(style) { this.style = style; return this; }
    };
    return button;
  };
  
  const createActionRowBuilder = () => {
    const row = {
      components: [],
      addComponents: function(...comps) { 
        this.components.push(...comps); 
        return this; 
      }
    };
    return row;
  };
  
  const createEmbedBuilder = () => {
    const embed = {
      title: '',
      description: '',
      color: 0,
      fields: [],
      footer: {},
      setTitle: function(title) { this.title = title; return this; },
      setDescription: function(desc) { this.description = desc; return this; },
      addFields: function(...fields) { 
        this.fields.push(...fields); 
        return this; 
      },
      setColor: function(color) { this.color = color; return this; },
      setFooter: function(footer) { this.footer = footer; return this; },
      setTimestamp: function() { this.timestamp = new Date(); return this; }
    };
    return embed;
  };

  return {
    SlashCommandBuilder: jest.fn().mockImplementation(() => ({
      setName: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addStringOption: jest.fn().mockImplementation(fn => {
        fn({
          setName: jest.fn().mockReturnThis(),
          setDescription: jest.fn().mockReturnThis(),
          setRequired: jest.fn().mockReturnThis()
        });
        return this;
      }),
      toJSON: jest.fn().mockReturnValue({})
    })),
    ActionRowBuilder: jest.fn().mockImplementation(createActionRowBuilder),
    ButtonBuilder: jest.fn().mockImplementation(createButtonBuilder),
    ButtonStyle: {
      Primary: 1,
      Secondary: 2,
      Success: 3,
      Danger: 4
    },
    EmbedBuilder: jest.fn().mockImplementation(createEmbedBuilder)
  };
});

// Mock the orchestration module
const mockProcessQuizCommand = jest.fn();
const mockHandleQuizApproval = jest.fn();

// Setup default response for processQuizCommand
mockProcessQuizCommand.mockResolvedValue({
  success: true,
  quiz: {
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'Test Article',
    questions: [
      {
        question: 'What is blockchain?',
        options: ['A database', 'A distributed ledger', 'A programming language', 'A company'],
        correctAnswer: 'A distributed ledger'
      }
    ]
  }
});

jest.mock('../../orchestration', () => {
  return {
    processQuizCommand: jest.fn((...args) => mockProcessQuizCommand(...args)),
    handleQuizApproval: jest.fn((...args) => mockHandleQuizApproval(...args)),
    processQuizResults: jest.fn(),
    handleQuizExpiry: jest.fn()
  };
});

// Mock the contract interaction
const mockCreateEscrow = jest.fn();
jest.mock('../../contracts/quizEscrow', () => ({
  createQuizEscrow: (params) => mockCreateEscrow(params)
}));

// Mock the quiz generator
const mockGenerateQuiz = jest.fn();
jest.mock('../../quiz/quizGenerator', () => ({
  generateQuiz: (url) => mockGenerateQuiz(url)
}));

// Import the module to test
const { 
  askCommand, 
  handleAskCommand,
  handleQuizApproval,
  handleQuizCancellation,
  publishQuiz
} = require('../../bot/commands/ask');

describe('Discord Command Handler', () => {
  // Setup common test variables
  let interaction;
  let quizData;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup interaction mock
    interaction = {
      options: {
        getString: jest.fn(),
        getInteger: jest.fn(),
      },
      user: { id: 'user123', username: 'testuser' },
      reply: mockInteractionReply,
      editReply: mockEditReply,
      followUp: mockFollowUp,
      channel: { send: mockChannelSend }
    };
    
    // Mock quiz data
    quizData = {
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Test Article',
      questions: [
        {
          question: 'What is blockchain?',
          options: ['A database', 'A distributed ledger', 'A programming language', 'A company'],
          correctAnswer: 'A distributed ledger'
        },
        {
          question: 'What are smart contracts used for?',
          options: ['To make money', 'Automated execution of agreements', 'Storing data', 'Creating websites'],
          correctAnswer: 'Automated execution of agreements'
        }
      ]
    };
  });

  // Test /ask command registration and parsing
  describe('/ask Command', () => {
    test('should register the /ask command with correct options', () => {
      // Verify the command is properly exported
      expect(askCommand).toBeDefined();
      expect(askCommand.data).toBeDefined();
      expect(askCommand.execute).toBeDefined();
      
      // Check command structure from the JSON data
      const commandData = askCommand.data.toJSON();
      expect(commandData.name).toBe('ask');
      expect(commandData.description).toContain('quiz');
    });

    test('should parse URL parameter correctly', async () => {
      // Setup test data
      const testUrl = 'https://example.com/article';
      
      // Mock interaction.options.getString to return test URL
      interaction.options.getString.mockReturnValueOnce(testUrl);
      
      // Mock successful quiz generation
      mockProcessQuizCommand.mockResolvedValueOnce({
        success: true,
        quiz: {
          id: 'quiz123',
          questions: [{ question: 'Test Question', options: ['A', 'B', 'C', 'D'] }]
        }
      });
      
      // Call the handler
      await handleAskCommand(interaction);
      
      // Check URL was properly parsed and passed to processQuizCommand
      expect(interaction.options.getString).toHaveBeenCalledWith('url');
      expect(mockProcessQuizCommand).toHaveBeenCalledWith(expect.objectContaining({
        url: testUrl
      }));
    });

    test('should handle optional token parameter with default value', async () => {
      // Setup test
      const testUrl = 'https://example.com';
      interaction.options.getString.mockReturnValueOnce(testUrl);
      interaction.options.getString.mockReturnValueOnce(null); // No token (should use default)
      
      // Mock successful quiz generation
      mockProcessQuizCommand.mockResolvedValueOnce({
        success: true,
        quiz: {
          id: 'quiz123',
          questions: [{ question: 'Test Question', options: ['A', 'B', 'C', 'D'] }]
        }
      });
      
      // Execute the command with no token provided
      await handleAskCommand(interaction);
      
      // Verify correct parameters were passed to processQuizCommand
      expect(mockProcessQuizCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          url: testUrl,
          token: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1' // Default token
        })
      );
    });

    test('should handle optional chain parameter with default value', async () => {
      // Setup test
      const testUrl = 'https://example.com';
      interaction.options.getString.mockReturnValueOnce(testUrl);
      interaction.options.getString.mockReturnValueOnce(null); // No token
      interaction.options.getInteger.mockReturnValueOnce(null); // No chain provided (should use default)
      
      // Mock successful quiz generation
      mockProcessQuizCommand.mockResolvedValueOnce({
        success: true,
        quiz: {
          id: 'quiz123',
          questions: [{ question: 'Test Question', options: ['A', 'B', 'C', 'D'] }]
        }
      });
      
      // Execute the command with no chain provided
      await handleAskCommand(interaction);
      
      // Verify correct parameters were passed to processQuizCommand
      expect(mockProcessQuizCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          url: testUrl,
          chain: 8453 // Default chain (Base)
        })
      );
    });

    test('should handle optional amount parameter with default value', async () => {
      // Setup test
      const testUrl = 'https://example.com';
      interaction.options.getString.mockReturnValueOnce(testUrl);
      interaction.options.getString.mockReturnValueOnce(null); // No token
      interaction.options.getInteger.mockReturnValueOnce(null); // No chain
      interaction.options.getInteger.mockReturnValueOnce(null); // No amount (should use default)
      
      // Mock successful quiz generation
      mockProcessQuizCommand.mockResolvedValueOnce({
        success: true,
        quiz: {
          id: 'quiz123',
          questions: [{ question: 'Test Question', options: ['A', 'B', 'C', 'D'] }]
        }
      });
      
      // Execute the command with no amount provided
      await handleAskCommand(interaction);
      
      // Verify correct parameters were passed to processQuizCommand
      expect(mockProcessQuizCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          url: testUrl,
          amount: 10000 // Default amount
        })
      );
    });
  });

  // Test ephemeral preview and approval workflow
  describe('Quiz Preview and Approval', () => {
    beforeEach(() => {
      // Mock a successful quiz generation
      mockGenerateQuiz.mockResolvedValue(quizData);
    });
    
    test('should generate ephemeral preview message', async () => {
      // Setup URL parameter
      interaction.options.getString.mockImplementation(name => {
        if (name === 'url') return 'https://example.com/article';
        return null;
      });
      
      // Execute command
      await handleAskCommand(interaction);
      
      // Verify ephemeral preview was sent
      expect(mockInteractionReply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
          components: expect.any(Array),
          embeds: expect.any(Array)
        })
      );
    });

    test('should include approval/cancel buttons in preview', async () => {
      // Setup URL parameter
      interaction.options.getString.mockImplementation(name => {
        if (name === 'url') return 'https://example.com/article';
        return null;
      });
      
      // Execute command
      await handleAskCommand(interaction);
      
      // Verify buttons were included in the reply
      expect(mockInteractionReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  customId: expect.stringContaining('approve'),
                  style: expect.any(Number)
                }),
                expect.objectContaining({
                  customId: expect.stringContaining('cancel'),
                  style: expect.any(Number)
                })
              ])
            })
          ])
        })
      );
    });

    test('should handle approval button interaction', async () => {
      // Create a mock button interaction
      const buttonInteraction = {
        customId: 'approve_quiz_123',
        message: { 
          embeds: [{ title: 'Quiz Preview' }],
          components: []
        },
        update: jest.fn(),
        user: { id: 'user123' },
        channel: { send: mockChannelSend }
      };
      
      // Mock escrow creation success
      mockCreateEscrow.mockResolvedValueOnce({ contractAddress: '0xQuizContract123' });
      
      // Execute approval handler
      await handleQuizApproval(buttonInteraction, quizData);
      
      // Verify interaction was updated
      expect(buttonInteraction.update).toHaveBeenCalled();
      
      // Verify quiz was published to the channel
      expect(mockChannelSend).toHaveBeenCalled();
    });

    test('should handle cancel button interaction', async () => {
      // Create a mock button interaction
      const buttonInteraction = {
        customId: 'cancel_quiz_123',
        message: { 
          embeds: [{ title: 'Quiz Preview' }],
          components: []
        },
        update: jest.fn(),
        user: { id: 'user123' }
      };
      
      // Execute cancel handler
      await handleQuizCancellation(buttonInteraction);
      
      // Verify interaction was updated with cancellation message
      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('cancelled'),
          components: []  // Buttons removed
        })
      );
    });
  });

  // Test quiz publishing
  describe('Quiz Publishing', () => {
    test('should publish quiz to channel after approval', async () => {
      // Setup mock data
      const quizId = '123';
      const contractAddress = '0xQuizContract123';
      
      // Execute publish function
      await publishQuiz(interaction.channel, quizData, quizId, contractAddress);
      
      // Verify message was sent to channel
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    test('should include expiry time in published quiz', async () => {
      // Setup mock data
      const quizId = '123';
      const contractAddress = '0xQuizContract123';
      
      // Get tomorrow's date in UTC
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(23, 59, 59, 999);
      
      // Execute publish function
      await publishQuiz(interaction.channel, quizData, quizId, contractAddress);
      
      // Verify expiry is mentioned in the message
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              footer: expect.objectContaining({
                text: expect.stringContaining('Expires')
              })
            })
          ])
        })
      );
    });

    test('should format quiz questions correctly', async () => {
      // Setup mock data
      const quizId = '123';
      const contractAddress = '0xQuizContract123';
      
      // Execute publish function
      await publishQuiz(interaction.channel, quizData, quizId, contractAddress);
      
      // Verify questions are formatted
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining(quizData.questions[0].question)
            })
          ])
        })
      );
    });
    
    test('should include token reward information', async () => {
      // Setup mock data
      const quizId = '123';
      const contractAddress = '0xQuizContract123';
      const tokenAddress = '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1';
      const chainId = 8453;
      const amount = 10000;
      
      // Execute publish function with reward info
      await publishQuiz(
        interaction.channel, 
        quizData, 
        quizId, 
        contractAddress, 
        { tokenAddress, chainId, amount }
      );
      
      // Verify reward info is included
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: expect.stringContaining('Reward'),
                  value: expect.stringContaining('10000')
                })
              ])
            })
          ])
        })
      );
    });
  });
});
