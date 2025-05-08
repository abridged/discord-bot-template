/**
 * Unit Tests for the InteractionCreate Event Handler
 * 
 * These tests cover the functionality of the bot's interaction handler,
 * which is responsible for routing Discord interactions to the appropriate
 * command handlers.
 */

// Import the actual module (which exports an object with name and execute properties)
const interactionCreateHandler = require('../../../bot/events/interactionCreate');

// Set global timeout to prevent hanging tests
jest.setTimeout(5000);

// For simplicity in tests, extract the execute function
const handleInteraction = interactionCreateHandler.execute;

// Mock Discord.js client and commands
const mockClient = {
  commands: new Map(),
  user: { id: 'bot123' }
};

// Mock command handler for the ask command
const mockAskCommand = {
  execute: jest.fn().mockResolvedValue()
};

// Mock command handler for the ping command
const mockPingCommand = {
  execute: jest.fn().mockResolvedValue()
};

// Set up mock commands
mockClient.commands.set('ask', mockAskCommand);
mockClient.commands.set('ping', mockPingCommand);

describe('InteractionCreate Event Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  
  afterEach(() => {
    // Clean up any lingering timers to prevent hanging
    jest.clearAllTimers();
  });

  //--------------------------------------------------------------
  // Command Execution
  //--------------------------------------------------------------
  describe('Command Execution', () => {
    test('should execute the correct command based on interaction name', async () => {
      // Create mock interaction for ask command
      const askInteraction = {
        isCommand: () => true,
        commandName: 'ask',
        client: mockClient,
        reply: jest.fn().mockResolvedValue()
      };
      
      // Handle interaction
      await handleInteraction(askInteraction);
      
      // Should execute the ask command
      expect(mockAskCommand.execute).toHaveBeenCalledWith(askInteraction);
      expect(mockPingCommand.execute).not.toHaveBeenCalled();
    });
    
    test('should handle ping command', async () => {
      // Create mock interaction for ping command
      const pingInteraction = {
        isCommand: () => true,
        commandName: 'ping',
        client: mockClient,
        reply: jest.fn().mockResolvedValue()
      };
      
      // Handle interaction
      await handleInteraction(pingInteraction);
      
      // Should execute the ping command
      expect(mockPingCommand.execute).toHaveBeenCalledWith(pingInteraction);
      expect(mockAskCommand.execute).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------------------------------
  // Error Handling
  //--------------------------------------------------------------
  describe('Error Handling', () => {
    test('should handle unknown commands gracefully', async () => {
      // Create mock interaction for unknown command
      const unknownInteraction = {
        isCommand: () => true,
        commandName: 'unknown',
        client: mockClient,
        reply: jest.fn().mockResolvedValue()
      };
      
      // Spy on console.error to silence any error logs during test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Handle interaction
        await handleInteraction(unknownInteraction);
        
        // Should respond with error message
        expect(unknownInteraction.reply).toHaveBeenCalledWith({
          content: expect.stringContaining('no handler'),
          ephemeral: true
        });
      } finally {
        // Clean up spy
        consoleErrorSpy.mockRestore();
      }
    });
    
    test('should handle command execution errors', async () => {
      // Mock command to throw error
      mockAskCommand.execute.mockRejectedValueOnce(new Error('Command failed'));
      
      // Create mock interaction
      const errorInteraction = {
        isCommand: () => true,
        commandName: 'ask',
        client: mockClient,
        reply: jest.fn().mockResolvedValue()
      };
      
      // Spy on console.error to silence error logs
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Handle interaction with timeout to prevent hanging
        await Promise.race([
          handleInteraction(errorInteraction),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test timed out')), 1000)
          )
        ]);
        
        // Should respond with error message
        expect(errorInteraction.reply).toHaveBeenCalledWith({
          content: expect.stringContaining('error'),
          ephemeral: true
        });
      } finally {
        // Clean up spy
        consoleErrorSpy.mockRestore();
      }
    });
  });

  //--------------------------------------------------------------
  // Interaction Types
  //--------------------------------------------------------------
  describe('Interaction Types', () => {
    test('should handle non-command interactions', async () => {
      // Create mock interaction for button click
      const buttonInteraction = {
        isCommand: () => false,
        isButton: () => true,
        customId: 'confirm_quiz',
        client: mockClient
      };
      
      // Silence console errors
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // No error should occur (with timeout safety)
        await Promise.race([
          expect(handleInteraction(buttonInteraction)).resolves.not.toThrow(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test timed out')), 1000)
          )
        ]);
        
        // Commands should not be executed for non-command interactions
        expect(mockAskCommand.execute).not.toHaveBeenCalled();
        expect(mockPingCommand.execute).not.toHaveBeenCalled();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
    
    test('should handle button interactions related to quizzes', async () => {
      // Mock client with quiz handler
      const clientWithQuizHandler = {
        ...mockClient,
        quizHandler: {
          handleQuizInteraction: jest.fn().mockResolvedValue()
        }
      };
      
      // Create mock button interaction for quiz
      const quizButtonInteraction = {
        isCommand: () => false,
        isButton: () => true,
        customId: 'quiz_answer_1',
        client: clientWithQuizHandler
      };
      
      // Handle interaction
      await handleInteraction(quizButtonInteraction);
      
      // Should forward to quiz handler
      expect(clientWithQuizHandler.quizHandler.handleQuizInteraction)
        .toHaveBeenCalledWith(quizButtonInteraction);
    });
  });

  //--------------------------------------------------------------
  // Security Features
  //--------------------------------------------------------------
  describe('Security Features', () => {
    test('should ignore self-interactions', async () => {
      // Create mock interaction from the bot itself
      const selfInteraction = {
        isCommand: () => true,
        commandName: 'ask',
        user: { id: 'bot123' }, // Same ID as bot
        client: mockClient,
        reply: jest.fn().mockResolvedValue()
      };
      
      // Handle interaction
      await handleInteraction(selfInteraction);
      
      // Should not execute any commands or replies
      expect(mockAskCommand.execute).not.toHaveBeenCalled();
      expect(selfInteraction.reply).not.toHaveBeenCalled();
    });
    
    test('should protect against spam with cooldowns', async () => {
      // Mock Date.now to return a consistent value for testing
      const originalDateNow = Date.now;
      const mockNow = 1629380000000; // Fixed timestamp
      Date.now = jest.fn().mockReturnValue(mockNow);
      
      try {
        // Create a mock client with cooldowns
        const clientWithCooldowns = {
          ...mockClient,
          cooldowns: new Map()
        };
        
        // Add a cooldown for the ask command (3 second cooldown)
        const commandCooldowns = new Map();
        commandCooldowns.set('user123', mockNow);
        clientWithCooldowns.cooldowns.set('ask', commandCooldowns);
        
        // Create mock interaction
        const spamInteraction = {
          isCommand: () => true,
          commandName: 'ask',
          user: { id: 'user123' },
          client: clientWithCooldowns,
          reply: jest.fn().mockResolvedValue()
        };
        
        // Capture console errors
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        try {
          // Handle interaction with timeout safety
          await Promise.race([
            handleInteraction(spamInteraction),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Test timed out')), 1000)
            )
          ]);
          
          // Should respond with cooldown message
          expect(spamInteraction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('cooldown'),
            ephemeral: true
          });
          
          // Command should not be executed
          expect(mockAskCommand.execute).not.toHaveBeenCalled();
        } finally {
          consoleErrorSpy.mockRestore();
        }
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });
  });
});
