/**
 * Orchestration Import Test - Isolate Hanging Issue
 * Tests orchestration module import specifically
 */

describe('Orchestration Module Import', () => {
  test('should import orchestration module without hanging', async () => {
    // Set test environment first
    process.env.NODE_ENV = 'test';
    process.env.USE_REAL_BLOCKCHAIN = 'false';
    
    // Test the import that's causing issues
    const orchestration = require('../../orchestration');
    
    expect(orchestration).toBeDefined();
    expect(orchestration.processQuizCommand).toBeDefined();
    expect(orchestration.handleQuizApproval).toBeDefined();
  }, 5000); // 5 second timeout

  test('should call processQuizCommand in test mode', async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.USE_REAL_BLOCKCHAIN = 'false';
    
    const { processQuizCommand } = require('../../orchestration');
    
    // Create minimal mock interaction
    const mockInteraction = {
      reply: jest.fn().mockResolvedValue(undefined),
      user: { id: 'test-user', username: 'testuser' },
      commandName: 'mother'
    };
    
    // Test with timeout
    const result = await Promise.race([
      processQuizCommand(mockInteraction),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timed out')), 3000)
      )
    ]);
    
    expect(result).toBeDefined();
  }, 5000);
});
