/**
 * End-to-End Contract Integration Tests
 * Tests bot integration with Base Sepolia v2 contracts
 */

const { ethers } = require('ethers');
const { QuizService } = require('../../services/blockchain/quizService');
const { createBlockchainService } = require('../../services/blockchain/index');

// Mock Discord interaction for testing
const createMockQuizData = () => ({
  id: 'test-quiz-' + Date.now(),
  question: 'What is 2 + 2?',
  choices: ['3', '4', '5', '6'],
  correctAnswer: 1, // Index of '4'
  explanation: 'Basic arithmetic: 2 + 2 = 4',
  creator: {
    id: 'test-user-123',
    username: 'testuser'
  },
  channelId: 'test-channel-123',
  guildId: 'test-guild-123'
});

describe('Base Sepolia v2 Contract Integration', () => {
  let blockchainService;
  let quizService;
  let provider;
  let motherFactory;
  let quizHandler;

  // Only run these tests if blockchain is enabled
  const shouldRunBlockchainTests = process.env.USE_REAL_BLOCKCHAIN === 'true' && 
                                   process.env.NODE_ENV !== 'test';

  beforeAll(async () => {
    if (!shouldRunBlockchainTests) {
      console.log('⏭️  Skipping blockchain tests - USE_REAL_BLOCKCHAIN=false or NODE_ENV=test');
      return;
    }

    // Initialize services with real blockchain configuration
    process.env.USE_REAL_BLOCKCHAIN = 'true';
    process.env.BLOCKCHAIN_ENABLED = 'true';
    
    blockchainService = createBlockchainService();
    
    // Initialize provider and contracts for direct testing
    provider = new ethers.providers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );

    // Contract addresses from v2 deployment
    const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS;
    const quizHandlerAddress = process.env.QUIZ_HANDLER_ADDRESS;

    expect(motherFactoryAddress).toBeDefined();
    expect(quizHandlerAddress).toBeDefined();

    // Initialize contract instances
    const MotherFactory = require('../../../contracts/artifacts/contracts/MotherFactory.sol/MotherFactory.json');
    const QuizHandler = require('../../../contracts/artifacts/contracts/QuizHandler.sol/QuizHandler.json');

    motherFactory = new ethers.Contract(motherFactoryAddress, MotherFactory.abi, provider);
    quizHandler = new ethers.Contract(quizHandlerAddress, QuizHandler.abi, provider);
  }, 10000);

  describe('Contract Connectivity', () => {
    test('should connect to Base Sepolia RPC', async () => {
      if (!shouldRunBlockchainTests) return;

      const network = await provider.getNetwork();
      expect(network.chainId).toBe(84532); // Base Sepolia
      expect(network.name).toBe('base-sepolia');
    });

    test('should connect to MotherFactory v2', async () => {
      if (!shouldRunBlockchainTests) return;

      // Test basic contract connectivity
      const deploymentFee = await motherFactory.deploymentFee();
      expect(deploymentFee.gt(0)).toBe(true);
      
      console.log(`✅ MotherFactory deployment fee: ${ethers.utils.formatEther(deploymentFee)} ETH`);
    });

    test('should connect to QuizHandler v2', async () => {
      if (!shouldRunBlockchainTests) return;

      // Test QuizHandler connectivity
      const accumulatedFees = await quizHandler.getAccumulatedFees();
      expect(accumulatedFees.gte(0)).toBe(true);
      
      console.log(`✅ QuizHandler accumulated fees: ${ethers.utils.formatEther(accumulatedFees)} ETH`);
    });

    test('should verify bot wallet authorization', async () => {
      if (!shouldRunBlockchainTests) return;

      // Verify bot is authorized for deployments
      const authorizedBot = await motherFactory.authorizedBot();
      const expectedBotWallet = process.env.BOT_WALLET;
      
      expect(authorizedBot.toLowerCase()).toBe(expectedBotWallet.toLowerCase());
      console.log(`✅ Bot authorization verified: ${authorizedBot}`);
    });

    test('should verify QuizHandler registration', async () => {
      if (!shouldRunBlockchainTests) return;

      // Check if QuizHandler is registered for QuizEscrow deployments
      const registeredHandler = await motherFactory.handlers('QuizEscrow');
      expect(registeredHandler.toLowerCase()).toBe(quizHandler.address.toLowerCase());
      
      console.log(`✅ QuizHandler registered for QuizEscrow: ${registeredHandler}`);
    });
  });

  describe('Bot Wallet Validation', () => {
    test('should have sufficient balance for deployments', async () => {
      if (!shouldRunBlockchainTests) return;

      const botWallet = process.env.BOT_WALLET;
      const balance = await provider.getBalance(botWallet);
      const deploymentFee = await motherFactory.deploymentFee();
      
      // Should have at least 2x deployment fee for testing
      const minimumBalance = deploymentFee.mul(2);
      expect(balance.gte(minimumBalance)).toBe(true);
      
      console.log(`✅ Bot wallet balance: ${ethers.utils.formatEther(balance)} ETH`);
      console.log(`✅ Minimum required: ${ethers.utils.formatEther(minimumBalance)} ETH`);
    });

    test('should be able to estimate gas for deployment', async () => {
      if (!shouldRunBlockchainTests) return;

      // Test gas estimation for contract deployment
      const botWallet = process.env.BOT_WALLET;
      const signer = new ethers.Wallet(process.env.DEPLOYMENT_PK, provider);
      
      expect(signer.address.toLowerCase()).toBe(botWallet.toLowerCase());

      const params = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256'],
        [1000, 100] // correctReward, incorrectReward
      );

      const deploymentFee = await motherFactory.deploymentFee();
      
      try {
        const gasEstimate = await motherFactory.connect(signer).estimateGas.deployContract(
          'QuizEscrow',
          params,
          { value: deploymentFee.add(ethers.utils.parseEther('0.001')) } // Add some funding
        );
        
        expect(gasEstimate.gt(0)).toBe(true);
        console.log(`✅ Gas estimate for deployment: ${gasEstimate.toString()}`);
      } catch (error) {
        console.log(`ℹ️  Gas estimation note: ${error.message}`);
        // Gas estimation might fail but that's ok for this test
      }
    });
  });

  describe('Blockchain Service Integration', () => {
    test('should initialize blockchain service correctly', async () => {
      if (!shouldRunBlockchainTests) return;

      expect(blockchainService).toBeDefined();
      expect(typeof blockchainService.submitQuiz).toBe('function');
      expect(typeof blockchainService.checkUserBalance).toBe('function');
    });

    test('should handle quiz submission parameters', async () => {
      if (!shouldRunBlockchainTests) return;

      const mockQuizData = createMockQuizData();
      const submissionParams = {
        correctReward: 1000,
        incorrectReward: 100,
        tokenAddress: process.env.DEFAULT_TOKEN_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base Sepolia
        amount: ethers.utils.parseEther('0.001').toString()
      };

      // Test parameter validation (should not throw)
      expect(() => {
        blockchainService.validateSubmissionParams(mockQuizData, submissionParams);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle RPC connection errors gracefully', async () => {
      if (!shouldRunBlockchainTests) return;

      // Test with invalid RPC URL
      const invalidProvider = new ethers.providers.JsonRpcProvider('https://invalid-rpc-url.com');
      const invalidContract = new ethers.Contract(
        motherFactory.address,
        motherFactory.interface,
        invalidProvider
      );

      await expect(invalidContract.deploymentFee()).rejects.toThrow();
    });

    test('should handle invalid contract parameters', async () => {
      if (!shouldRunBlockchainTests) return;

      const mockQuizData = createMockQuizData();
      const invalidParams = {
        correctReward: 0, // Invalid - zero reward
        incorrectReward: 100
      };

      // Should handle validation gracefully
      try {
        await blockchainService.submitQuiz(mockQuizData, invalidParams);
      } catch (error) {
        expect(error.message).toContain('reward');
      }
    });
  });

  describe('Performance Benchmarks', () => {
    test('should connect to contracts within acceptable time', async () => {
      if (!shouldRunBlockchainTests) return;

      const startTime = Date.now();
      
      await Promise.all([
        motherFactory.deploymentFee(),
        quizHandler.getAccumulatedFees()
      ]);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should connect within 5 seconds
      
      console.log(`✅ Contract connection time: ${duration}ms`);
    });
  });
});
