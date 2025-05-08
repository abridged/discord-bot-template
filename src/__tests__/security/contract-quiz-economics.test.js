/**
 * @jest-environment node
 */

const { ethers } = require('ethers');
const { createQuizEscrow } = require('../../contracts/quizEscrow');
const { mockProvider, mockContract, mockSigner } = require('../mocks/ethersjs');

// Mocking environment for testing
jest.mock('ethers', () => {
  const originalEthers = jest.requireActual('ethers');
  return {
    ...originalEthers,
    providers: {
      JsonRpcProvider: jest.fn(),
    },
    Contract: jest.fn(),
    utils: {
      ...originalEthers.utils,
      parseUnits: jest.fn().mockImplementation((value, decimals) => {
        return ethers.BigNumber.from(value).mul(ethers.BigNumber.from(10).pow(decimals));
      }),
      formatUnits: jest.fn().mockImplementation((value, decimals) => {
        return ethers.BigNumber.from(value).div(ethers.BigNumber.from(10).pow(decimals)).toString();
      }),
    },
  };
});

describe('Quiz Token Economics Edge Cases', () => {
  let provider, signer, tokenContract, factoryContract, quizContract;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mocks
    provider = mockProvider();
    signer = mockSigner();
    tokenContract = mockContract();
    factoryContract = mockContract();
    quizContract = mockContract();
    
    // Mock common contract behaviors
    tokenContract.decimals = jest.fn().mockResolvedValue(18);
    tokenContract.balanceOf = jest.fn().mockResolvedValue(ethers.utils.parseUnits('1000', 18));
    tokenContract.allowance = jest.fn().mockResolvedValue(ethers.utils.parseUnits('0', 18));
    tokenContract.approve = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    tokenContract.transfer = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    // Mock factory contract
    factoryContract.createQuiz = jest.fn().mockResolvedValue({
      hash: '0xabcdef',
      wait: jest.fn().mockResolvedValue({ 
        status: 1,
        events: [{
          args: { quizContract: '0xQuiz1234567890123456789012345678901234567' }
        }]
      })
    });
    
    // Mock quiz contract
    quizContract.quizId = jest.fn().mockResolvedValue('test-quiz');
    quizContract.quizDeadline = jest.fn().mockResolvedValue(Math.floor(Date.now() / 1000) + 86400);
    quizContract.token = jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
    quizContract.totalAmount = jest.fn().mockResolvedValue(ethers.utils.parseUnits('10000', 18));
    quizContract.quizEnd = jest.fn().mockResolvedValue(false);
    quizContract.getParticipantCount = jest.fn().mockResolvedValue(5);
    quizContract.getCorrectAnswerCount = jest.fn().mockResolvedValue(3);
  });

  test('Should handle extremely imbalanced participant numbers', async () => {
    // Test scenarios with different participant distributions
    const scenarios = [
      { 
        name: 'All correct', 
        participants: 50, 
        correctAnswers: 50,
        expectedDistributionCorrect: '200', // 10000 tokens / 50 correct participants (200 each)
        expectedDistributionIncorrect: '0'   // No incorrect participants
      },
      { 
        name: 'All incorrect', 
        participants: 50, 
        correctAnswers: 0,
        expectedDistributionCorrect: '0',    // No correct participants
        expectedDistributionIncorrect: '200' // 10000 tokens / 50 incorrect participants (200 each)
      },
      { 
        name: 'Single correct answer', 
        participants: 50, 
        correctAnswers: 1,
        expectedDistributionCorrect: '7500', // 75% of 10000 tokens (7500) to 1 participant
        expectedDistributionIncorrect: '51.02' // 25% of 10000 tokens (2500) to 49 participants (about 51.02 each)
      },
      { 
        name: 'Single incorrect answer', 
        participants: 50, 
        correctAnswers: 49,
        expectedDistributionCorrect: '153.06', // 75% of 10000 tokens (7500) to 49 participants (about 153.06 each)
        expectedDistributionIncorrect: '2500'  // 25% of 10000 tokens (2500) to 1 participant
      },
      { 
        name: 'Extreme participation', 
        participants: 1000, 
        correctAnswers: 500,
        expectedDistributionCorrect: '15',    // 75% of 10000 tokens (7500) to 500 participants (15 each)
        expectedDistributionIncorrect: '5'    // 25% of 10000 tokens (2500) to 500 participants (5 each)
      }
    ];
    
    // Helper function to calculate quiz rewards
    const calculateRewardDistribution = (totalAmount, totalParticipants, correctParticipants) => {
      if (totalParticipants === 0) {
        return { 
          correctReward: '0', 
          incorrectReward: '0',
          tokenDistribution: 'No participants'
        };
      }
      
      const incorrectParticipants = totalParticipants - correctParticipants;
      
      // Calculate rewards according to 75/25 distribution rule
      const totalTokens = ethers.utils.parseUnits(totalAmount, 18);
      
      if (correctParticipants === 0) {
        // Edge case: all answers incorrect - split evenly among incorrect
        const incorrectReward = incorrectParticipants > 0 
          ? totalTokens.div(incorrectParticipants) 
          : ethers.BigNumber.from(0);
          
        return {
          correctReward: '0',
          incorrectReward: ethers.utils.formatUnits(incorrectReward, 18),
          tokenDistribution: 'All incorrect'
        };
      }
      
      if (incorrectParticipants === 0) {
        // Edge case: all answers correct - split evenly among correct
        const correctReward = correctParticipants > 0 
          ? totalTokens.div(correctParticipants) 
          : ethers.BigNumber.from(0);
          
        return {
          correctReward: ethers.utils.formatUnits(correctReward, 18),
          incorrectReward: '0',
          tokenDistribution: 'All correct'
        };
      }
      
      // Normal case: 75% to correct, 25% to incorrect
      const correctPoolAmount = totalTokens.mul(75).div(100);
      const incorrectPoolAmount = totalTokens.mul(25).div(100);
      
      const correctReward = correctPoolAmount.div(correctParticipants);
      const incorrectReward = incorrectPoolAmount.div(incorrectParticipants);
      
      return {
        correctReward: ethers.utils.formatUnits(correctReward, 18),
        incorrectReward: ethers.utils.formatUnits(incorrectReward, 18),
        tokenDistribution: '75/25 split'
      };
    };
    
    // Test each scenario
    for (const scenario of scenarios) {
      // Update mock contract responses
      quizContract.getParticipantCount = jest.fn().mockResolvedValue(scenario.participants);
      quizContract.getCorrectAnswerCount = jest.fn().mockResolvedValue(scenario.correctAnswers);
      
      // Calculate reward distribution
      const distribution = calculateRewardDistribution(
        '10000', // Total tokens
        scenario.participants,
        scenario.correctAnswers
      );
      
      // Check if distribution matches expected values
      expect(parseFloat(distribution.correctReward)).toBeCloseTo(
        parseFloat(scenario.expectedDistributionCorrect), 
        scenario.name === 'Extreme participation' ? 0 : 2
      );
      
      expect(parseFloat(distribution.incorrectReward)).toBeCloseTo(
        parseFloat(scenario.expectedDistributionIncorrect), 
        scenario.name === 'Extreme participation' ? 0 : 2
      );
      
      console.log(`Scenario: ${scenario.name}`);
      console.log(`  Participants: ${scenario.participants}, Correct: ${scenario.correctAnswers}`);
      console.log(`  Correct reward: ${distribution.correctReward}, Incorrect reward: ${distribution.incorrectReward}`);
    }
  });

  test('Should handle dramatic token price fluctuations', async () => {
    // Mock token price oracle
    const mockPriceOracle = mockContract();
    const initialPrice = ethers.utils.parseUnits('1', 8); // $1 USD initial price
    
    let currentPrice = initialPrice;
    mockPriceOracle.latestRoundData = jest.fn().mockImplementation(async () => {
      return {
        answer: currentPrice,
        updatedAt: Math.floor(Date.now() / 1000) - 60 // Last update 1 minute ago
      };
    });
    
    // Helper to calculate minimum viable reward
    const calculateMinimumViableReward = async (totalAmount, participantCount) => {
      // Get current token price
      const { answer: priceData } = await mockPriceOracle.latestRoundData();
      const tokenPrice = priceData;
      
      // Calculate gas cost per participant (in USD)
      const gasPerClaim = ethers.BigNumber.from(100000); // 100k gas units per claim
      const gasPriceWei = await provider.getGasPrice();
      const ethPrice = ethers.utils.parseUnits('3000', 8); // $3000 USD per ETH
      
      const gasCostPerClaimUsd = gasPerClaim
        .mul(gasPriceWei)
        .mul(ethPrice)
        .div(ethers.utils.parseUnits('1', 18))
        .div(ethers.utils.parseUnits('1', 8));
      
      // Calculate minimum economically viable reward (3x gas cost)
      const minRewardUsd = gasCostPerClaimUsd.mul(3);
      
      // Convert to token amount
      const minRewardTokens = minRewardUsd
        .mul(ethers.utils.parseUnits('1', 18))
        .div(tokenPrice);
      
      // Total minimum reward needed for all participants
      const totalMinReward = minRewardTokens.mul(participantCount);
      
      // Check if quiz amount is sufficient
      const quizTokens = ethers.utils.parseUnits(totalAmount, 18);
      const isEconomicallyViable = quizTokens.gte(totalMinReward);
      
      return {
        minRewardPerParticipant: ethers.utils.formatUnits(minRewardTokens, 18),
        totalMinReward: ethers.utils.formatUnits(totalMinReward, 18),
        isEconomicallyViable,
        claimGasCostUsd: ethers.utils.formatUnits(gasCostPerClaimUsd, 8)
      };
    };
    
    // Helper to check if quiz rewards are still viable after price changes
    const assessQuizViabilityAfterPriceChange = async (quizParams, newPrice) => {
      // Calculate initial viability
      const initialViability = await calculateMinimumViableReward(
        quizParams.tokenAmount,
        quizParams.expectedParticipants
      );
      
      // Update price
      currentPrice = ethers.utils.parseUnits(newPrice.toString(), 8);
      
      // Calculate new viability
      const newViability = await calculateMinimumViableReward(
        quizParams.tokenAmount,
        quizParams.expectedParticipants
      );
      
      // If viability has changed, should take action
      if (initialViability.isEconomicallyViable && !newViability.isEconomicallyViable) {
        // Quiz has become uneconomical due to price decrease
        return {
          initialViability,
          newViability,
          action: 'Consider adding more funds or ending quiz early'
        };
      }
      
      if (!initialViability.isEconomicallyViable && newViability.isEconomicallyViable) {
        // Quiz has become economical due to price increase
        return {
          initialViability,
          newViability,
          action: 'Quiz is now economically viable, no action needed'
        };
      }
      
      return {
        initialViability,
        newViability,
        action: 'No change in economic viability, no action needed'
      };
    };
    
    // Test quiz creation with price awareness
    const quizParams = {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenAmount: '10000',
      quizId: 'price-fluctuation-test',
      quizDeadline: Math.floor(Date.now() / 1000) + 86400,
      chainId: 8453,
      expectedParticipants: 100
    };
    
    // Mock gas price
    provider.getGasPrice = jest.fn().mockResolvedValue(ethers.utils.parseUnits('50', 'gwei'));
    
    // Test 1: Initial price evaluation
    const initialViability = await calculateMinimumViableReward(
      quizParams.tokenAmount,
      quizParams.expectedParticipants
    );
    expect(initialViability.isEconomicallyViable).toBe(true);
    
    // Test 2: Token price crashes 90%
    const priceDropResult = await assessQuizViabilityAfterPriceChange(quizParams, 0.1);
    expect(priceDropResult.newViability.isEconomicallyViable).toBe(false);
    expect(priceDropResult.action).toContain('Consider adding more funds');
    
    // Test 3: Token price rises 300%
    const priceRiseResult = await assessQuizViabilityAfterPriceChange(quizParams, 3);
    expect(priceRiseResult.newViability.isEconomicallyViable).toBe(true);
    
    // Test 4: Extreme gas price spike combined with price drop
    provider.getGasPrice = jest.fn().mockResolvedValue(ethers.utils.parseUnits('500', 'gwei'));
    currentPrice = ethers.utils.parseUnits('0.5', 8); // $0.50 USD
    
    const gasAndPriceResult = await calculateMinimumViableReward(
      quizParams.tokenAmount,
      quizParams.expectedParticipants
    );
    expect(gasAndPriceResult.isEconomicallyViable).toBe(false);
    
    // The claim cost should be much higher now
    expect(parseFloat(gasAndPriceResult.claimGasCostUsd)).toBeGreaterThan(
      parseFloat(initialViability.claimGasCostUsd) * 5
    );
  });

  test('Should handle special case of all correct and all incorrect answers', async () => {
    // Mock quiz contract with dynamic participant data
    let participantAnswers = []; // Will contain true for correct, false for incorrect
    
    quizContract.getParticipantCount = jest.fn().mockImplementation(() => {
      return Promise.resolve(participantAnswers.length);
    });
    
    quizContract.getCorrectAnswerCount = jest.fn().mockImplementation(() => {
      return Promise.resolve(participantAnswers.filter(a => a).length);
    });
    
    quizContract.getWinnerAddresses = jest.fn().mockImplementation(() => {
      // Get addresses of participants with correct answers
      const winners = [];
      for (let i = 0; i < participantAnswers.length; i++) {
        if (participantAnswers[i]) {
          winners.push(`0xWinner${i}123456789012345678901234567890`);
        }
      }
      return Promise.resolve(winners);
    });
    
    quizContract.getLoserAddresses = jest.fn().mockImplementation(() => {
      // Get addresses of participants with incorrect answers
      const losers = [];
      for (let i = 0; i < participantAnswers.length; i++) {
        if (!participantAnswers[i]) {
          losers.push(`0xLoser${i}1234567890123456789012345678901`);
        }
      }
      return Promise.resolve(losers);
    });
    
    // Helper for distributing rewards
    const distributeQuizRewards = async () => {
      // Get quiz data
      const totalAmount = await quizContract.totalAmount();
      const totalParticipants = await quizContract.getParticipantCount();
      const correctParticipants = await quizContract.getCorrectAnswerCount();
      const incorrectParticipants = totalParticipants - correctParticipants;
      
      // Calculate reward distribution
      let correctReward = ethers.BigNumber.from(0);
      let incorrectReward = ethers.BigNumber.from(0);
      
      // Handle special cases
      if (totalParticipants === 0) {
        // No participants, return funds to sponsor
        const owner = await quizContract.owner();
        
        await quizContract.withdrawFunds(owner, {
          gasLimit: 200000
        });
        
        return {
          result: 'No participants, funds returned to sponsor',
          correctReward: '0',
          incorrectReward: '0'
        };
      } else if (correctParticipants === 0) {
        // All answers incorrect - everyone gets equal share
        incorrectReward = totalAmount.div(incorrectParticipants);
        
        // Get losers addresses
        const losers = await quizContract.getLoserAddresses();
        
        // Send rewards to losers
        for (const loser of losers) {
          await quizContract.sendReward(loser, incorrectReward, {
            gasLimit: 150000
          });
        }
        
        return {
          result: 'All answers incorrect, equal distribution to all participants',
          correctReward: '0',
          incorrectReward: ethers.utils.formatUnits(incorrectReward, 18)
        };
      } else if (incorrectParticipants === 0) {
        // All answers correct - everyone gets equal share
        correctReward = totalAmount.div(correctParticipants);
        
        // Get winners addresses
        const winners = await quizContract.getWinnerAddresses();
        
        // Send rewards to winners
        for (const winner of winners) {
          await quizContract.sendReward(winner, correctReward, {
            gasLimit: 150000
          });
        }
        
        return {
          result: 'All answers correct, equal distribution to all participants',
          correctReward: ethers.utils.formatUnits(correctReward, 18),
          incorrectReward: '0'
        };
      } else {
        // Normal case: 75/25 split
        const correctPoolAmount = totalAmount.mul(75).div(100);
        const incorrectPoolAmount = totalAmount.mul(25).div(100);
        
        correctReward = correctPoolAmount.div(correctParticipants);
        incorrectReward = incorrectPoolAmount.div(incorrectParticipants);
        
        // Get winners and losers
        const winners = await quizContract.getWinnerAddresses();
        const losers = await quizContract.getLoserAddresses();
        
        // Send rewards to winners
        for (const winner of winners) {
          await quizContract.sendReward(winner, correctReward, {
            gasLimit: 150000
          });
        }
        
        // Send rewards to losers
        for (const loser of losers) {
          await quizContract.sendReward(loser, incorrectReward, {
            gasLimit: 150000
          });
        }
        
        return {
          result: 'Normal 75/25 distribution',
          correctReward: ethers.utils.formatUnits(correctReward, 18),
          incorrectReward: ethers.utils.formatUnits(incorrectReward, 18)
        };
      }
    };
    
    // Override mock to make distribution function work
    quizContract.sendReward = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    quizContract.withdrawFunds = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    quizContract.owner = jest.fn().mockResolvedValue(await signer.getAddress());
    
    // Test 1: No participants
    participantAnswers = [];
    const noParticipantsResult = await distributeQuizRewards();
    expect(noParticipantsResult.result).toContain('No participants');
    expect(quizContract.withdrawFunds).toHaveBeenCalled();
    
    // Test 2: All answers correct
    participantAnswers = [true, true, true, true, true];
    const allCorrectResult = await distributeQuizRewards();
    expect(allCorrectResult.result).toContain('All answers correct');
    expect(quizContract.sendReward).toHaveBeenCalledTimes(5);
    expect(allCorrectResult.correctReward).toBe('2000.0'); // 10000 / 5 = 2000 each
    
    // Test 3: All answers incorrect
    participantAnswers = [false, false, false, false, false];
    
    // Reset mock call count
    quizContract.sendReward = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    const allIncorrectResult = await distributeQuizRewards();
    expect(allIncorrectResult.result).toContain('All answers incorrect');
    expect(quizContract.sendReward).toHaveBeenCalledTimes(5);
    expect(allIncorrectResult.incorrectReward).toBe('2000.0'); // 10000 / 5 = 2000 each
    
    // Test 4: Normal distribution
    participantAnswers = [true, true, true, false, false];
    
    // Reset mock call count
    quizContract.sendReward = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    const normalResult = await distributeQuizRewards();
    expect(normalResult.result).toContain('Normal 75/25');
    expect(quizContract.sendReward).toHaveBeenCalledTimes(5);
    expect(parseFloat(normalResult.correctReward)).toBeCloseTo(2500.0); // 7500 / 3 = 2500 each
    expect(parseFloat(normalResult.incorrectReward)).toBeCloseTo(1250.0); // 2500 / 2 = 1250 each
  });

  test('Should handle escrow contract lifecycle edge cases', async () => {
    // Mock quiz contract with specific lifecycle states
    let quizState = {
      quizId: 'lifecycle-test',
      quizDeadline: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
      totalAmount: ethers.utils.parseUnits('10000', 18),
      participantCount: 0,
      correctAnswerCount: 0,
      quizEnded: false,
      rewardsDistributed: false,
      createdAt: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    };
    
    // Update mock functions based on state
    const updateMocksFromState = () => {
      quizContract.quizId = jest.fn().mockResolvedValue(quizState.quizId);
      quizContract.quizDeadline = jest.fn().mockResolvedValue(quizState.quizDeadline);
      quizContract.totalAmount = jest.fn().mockResolvedValue(quizState.totalAmount);
      quizContract.getParticipantCount = jest.fn().mockResolvedValue(quizState.participantCount);
      quizContract.getCorrectAnswerCount = jest.fn().mockResolvedValue(quizState.correctAnswerCount);
      quizContract.quizEnd = jest.fn().mockImplementation(async () => {
        quizState.quizEnded = true;
        return {
          hash: '0x123456',
          wait: jest.fn().mockResolvedValue({ status: 1 })
        };
      });
      quizContract.distributeRewards = jest.fn().mockImplementation(async () => {
        if (!quizState.quizEnded) {
          throw new Error('Quiz must be ended before rewards can be distributed');
        }
        quizState.rewardsDistributed = true;
        return {
          hash: '0x123456',
          wait: jest.fn().mockResolvedValue({ status: 1 })
        };
      });
    };
    
    // Helper function to handle contract lifecycle
    const handleQuizLifecycle = async () => {
      // Get current time
      const now = Math.floor(Date.now() / 1000);
      
      // Check if quiz has expired
      const deadline = await quizContract.quizDeadline();
      const hasExpired = now > deadline;
      
      if (!hasExpired) {
        const timeRemaining = deadline - now;
        return {
          status: 'active',
          timeRemaining: `${Math.floor(timeRemaining / 3600)} hours, ${Math.floor((timeRemaining % 3600) / 60)} minutes`
        };
      }
      
      // Quiz has expired, check if it's been officially ended
      if (!quizState.quizEnded) {
        // End the quiz
        await quizContract.quizEnd();
      }
      
      // Check participant count
      const participantCount = await quizContract.getParticipantCount();
      
      if (participantCount === 0) {
        // No participants, refund sponsor
        await quizContract.withdrawFunds(await signer.getAddress());
        return { status: 'refunded', reason: 'No participants' };
      }
      
      // If rewards not yet distributed, distribute them
      if (!quizState.rewardsDistributed) {
        await quizContract.distributeRewards();
      }
      
      return { 
        status: 'completed', 
        participants: participantCount,
        correctAnswers: await quizContract.getCorrectAnswerCount()
      };
    };
    
    // Test 1: Active quiz
    updateMocksFromState();
    const activeResult = await handleQuizLifecycle();
    expect(activeResult.status).toBe('active');
    
    // Test 2: Expired but not ended
    quizState.quizDeadline = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    updateMocksFromState();
    
    const expiredResult = await handleQuizLifecycle();
    expect(quizState.quizEnded).toBe(true);
    expect(quizContract.quizEnd).toHaveBeenCalled();
    
    // Test 3: No participants
    quizState.quizEnded = false;
    quizState.participantCount = 0;
    updateMocksFromState();
    
    quizContract.withdrawFunds = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    const noParticipantsResult = await handleQuizLifecycle();
    expect(noParticipantsResult.status).toBe('refunded');
    expect(quizContract.withdrawFunds).toHaveBeenCalled();
    
    // Test 4: With participants, not distributed
    quizState.quizEnded = false;
    quizState.participantCount = 10;
    quizState.correctAnswerCount = 5;
    updateMocksFromState();
    
    const participantsResult = await handleQuizLifecycle();
    expect(quizState.quizEnded).toBe(true);
    expect(quizState.rewardsDistributed).toBe(true);
    expect(quizContract.distributeRewards).toHaveBeenCalled();
    expect(participantsResult.participants).toBe(10);
    expect(participantsResult.correctAnswers).toBe(5);
    
    // Test 5: Attempt to distribute before ending
    quizState.quizEnded = false;
    quizState.rewardsDistributed = false;
    updateMocksFromState();
    
    await expect(quizContract.distributeRewards()).rejects.toThrow(/Quiz must be ended/);
  });
});
