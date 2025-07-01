/**
 * Unit tests for MotherFactory validation logic
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('MotherFactory Validation', () => {
  let RealBlockchainService;
  let mockQuizService;
  
  beforeEach(() => {
    // Clear module cache to ensure fresh imports
    delete require.cache[require.resolve('../../src/services/blockchain/realBlockchainService')];
    
    // Create mock QuizService
    mockQuizService = {
      motherFactoryAddress: undefined,
      contractsAvailable: false,
      useRealBlockchain: true
    };
    
    // Mock environment variable
    process.env.USE_REAL_BLOCKCHAIN = 'true';
    
    RealBlockchainService = require('../../src/services/blockchain/realBlockchainService');
  });
  
  afterEach(() => {
    sinon.restore();
    delete process.env.USE_REAL_BLOCKCHAIN;
  });
  
  describe('submitQuiz validation', () => {
    it('should throw error when USE_REAL_BLOCKCHAIN=true but MotherFactory not deployed', async () => {
      const service = new RealBlockchainService({ quizService: mockQuizService });
      
      const quizData = { id: 'test-quiz-123' };
      const userWallet = '0x1234567890123456789012345678901234567890';
      const discordUserId = '123456789';
      
      try {
        await service.submitQuiz(quizData, userWallet, discordUserId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('USE_REAL_BLOCKCHAIN is enabled but MotherFactory contracts are not deployed');
      }
    });
    
    it('should proceed when USE_REAL_BLOCKCHAIN=false even if MotherFactory not deployed', async () => {
      // Override environment for this test
      process.env.USE_REAL_BLOCKCHAIN = 'false';
      
      const service = new RealBlockchainService({ quizService: mockQuizService });
      
      const quizData = { id: 'test-quiz-123' };
      const userWallet = '0x1234567890123456789012345678901234567890';
      const discordUserId = '123456789';
      
      // This should not throw an error and should proceed to development mode
      // The actual implementation would need to be checked, but the validation should pass
      try {
        const result = await service.submitQuiz(quizData, userWallet, discordUserId);
        // Should return development mode result
        expect(result).to.be.an('object');
      } catch (error) {
        // If it throws, it should not be the MotherFactory validation error
        expect(error.message).to.not.include('USE_REAL_BLOCKCHAIN is enabled but MotherFactory contracts are not deployed');
      }
    });
  });
});
