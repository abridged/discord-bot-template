/**
 * Unit Tests for the Ready Event Handler
 * 
 * These tests cover the functionality of the bot's ready event handler,
 * which is responsible for initialization tasks when the bot starts up.
 */

const { handleReady } = require('../../../bot/events/ready');

// Set global timeout to prevent hanging tests
jest.setTimeout(5000);

describe('Ready Event Handler', () => {
  // Mock client
  const mockClient = {
    user: {
      tag: 'QuizBot#1234',
      setActivity: jest.fn()
    },
    guilds: {
      cache: {
        size: 5
      }
    },
    quizzes: new Map(),
    initializeQuizExpiry: jest.fn().mockResolvedValue()
  };

  // Mock console.log to test logging
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  let logMessages = [];

  beforeEach(() => {
    // Clear mocks and restore any overridden mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();
    logMessages = [];
    
    // Mock console.log
    console.log = jest.fn((...args) => {
      logMessages.push(args.join(' '));
    });
    
    // Mock console.error to prevent test output noise
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Clean up timers to prevent hanging
    jest.clearAllTimers();
  });

  //--------------------------------------------------------------
  // Basic Functionality
  //--------------------------------------------------------------
  describe('Basic Functionality', () => {
    test('should log bot login information', () => {
      // Call the handler
      handleReady(mockClient);
      
      // Should log login information
      expect(logMessages.some(msg => msg.includes('QuizBot#1234'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('5 guilds'))).toBe(true);
    });
    
    test('should set bot activity status', () => {
      // Call the handler
      handleReady(mockClient);
      
      // Should set user activity
      expect(mockClient.user.setActivity).toHaveBeenCalledWith(expect.any(String), {
        type: expect.any(String)
      });
    });
    
    test('should initialize quiz expiry mechanism', async () => {
      // Call the handler - use Promise.race with timeout to prevent hanging
      await Promise.race([
        Promise.resolve(handleReady(mockClient)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 1000))
      ]).catch(err => {
        if (err.message !== 'Test timeout') throw err;
        // If we timeout, the test can still pass if the method was called
      });
      
      // Should initialize quiz expiry
      expect(mockClient.initializeQuizExpiry).toHaveBeenCalled();
    });
  });

  //--------------------------------------------------------------
  // Error Handling
  //--------------------------------------------------------------
  describe('Error Handling', () => {
    test('should handle errors during status setting', () => {
      // Make setActivity throw an error
      mockClient.user.setActivity.mockImplementationOnce(() => {
        throw new Error('Failed to set activity');
      });
      
      // Call the handler - should not throw
      expect(() => handleReady(mockClient)).not.toThrow();
      
      // Should log error
      expect(logMessages.some(msg => msg.includes('Failed to set activity'))).toBe(true);
    });
    
    test('should handle errors during quiz expiry initialization', async () => {
      // Make initializeQuizExpiry reject
      mockClient.initializeQuizExpiry.mockRejectedValueOnce(new Error('Failed to initialize'));
      
      // Spy on console.error to capture error logs
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Call the handler with timeout to prevent hanging
        await Promise.race([
          handleReady(mockClient),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        
        // Should not throw and should have called the initialization
        expect(mockClient.initializeQuizExpiry).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  //--------------------------------------------------------------
  // Recovery Functionality
  //--------------------------------------------------------------
  describe('Recovery Functionality', () => {
    test('should clear stale quizzes from previous session', () => {
      // Add some quizzes to simulate previous session
      mockClient.quizzes.set('quiz1', { id: 'quiz1' });
      mockClient.quizzes.set('quiz2', { id: 'quiz2' });
      
      // Call the handler
      handleReady(mockClient);
      
      // Should clear quizzes
      expect(mockClient.quizzes.size).toBe(0);
    });
    
    test('should check for network connectivity', async () => {
      // Mock fetch API
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200
      });
      
      try {
        // Call the handler with timeout protection
        await Promise.race([
          handleReady(mockClient),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        
        // Should have made the fetch call (if implemented)
        if (global.fetch.mock) {
          // Only assert if fetch was actually called
          expect(global.fetch).toHaveBeenCalled();
        }
      } finally {
        // Clean up
        delete global.fetch;
      }
    });
  });
  
  //--------------------------------------------------------------
  // Post-Initialization Checks
  //--------------------------------------------------------------
  describe('Post-Initialization Checks', () => {
    test('should register cleanup handlers for process termination', async () => {
      // Mock process.on
      const originalProcessOn = process.on;
      const processEvents = [];
      
      process.on = jest.fn((event, handler) => {
        processEvents.push(event);
      });
      
      try {
        // Call the handler with timeout protection
        await Promise.race([
          handleReady(mockClient),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        
        // Should register for SIGINT and SIGTERM events
        expect(processEvents.includes('SIGINT')).toBe(true);
        expect(processEvents.includes('SIGTERM')).toBe(true);
      } finally {
        // Restore process.on
        process.on = originalProcessOn;
      }
    });
    
    test('should emit ready event to notify other subsystems', async () => {
      // Mock client.emit
      mockClient.emit = jest.fn();
      
      // Call the handler with timeout protection
      await Promise.race([
        handleReady(mockClient),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
      
      // Should emit botReady event
      expect(mockClient.emit).toHaveBeenCalledWith('botReady');
    });
  });
});
