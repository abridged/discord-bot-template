/**
 * Simplified Discord Flow Tests - Diagnostic
 * Tests individual components to identify hanging issues
 */

const { createMockInteraction } = require('../helpers/discordMocks');

// Test just the basic imports first
describe('Discord Flow Components - Diagnostic', () => {
  test('should import mock helpers without hanging', () => {
    expect(createMockInteraction).toBeDefined();
    expect(typeof createMockInteraction).toBe('function');
  });

  test('should create mock interaction without hanging', () => {
    const interaction = createMockInteraction('/mother');
    expect(interaction).toBeDefined();
    expect(interaction.commandName).toBe('mother');
  });

  test('should import blockchain service without hanging', async () => {
    const { createBlockchainService } = require('../../services/blockchain/index');
    expect(createBlockchainService).toBeDefined();
  });

  test('should create blockchain service in test mode', async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_REAL_BLOCKCHAIN = 'false';
    
    const { createBlockchainService } = require('../../services/blockchain/index');
    const service = createBlockchainService();
    
    expect(service).toBeDefined();
  });
});
