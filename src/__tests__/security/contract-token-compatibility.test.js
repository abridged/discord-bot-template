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

describe('Contract Token Compatibility Edge Cases', () => {
  let provider, signer, tokenContract, factoryContract;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mocks
    provider = mockProvider();
    signer = mockSigner();
    tokenContract = mockContract();
    factoryContract = mockContract();
    
    // Default token behavior
    tokenContract.decimals = jest.fn().mockResolvedValue(18);
    tokenContract.balanceOf = jest.fn().mockResolvedValue(ethers.utils.parseUnits('1000', 18));
    tokenContract.allowance = jest.fn().mockResolvedValue(ethers.utils.parseUnits('0', 18));
    tokenContract.approve = jest.fn().mockResolvedValue({
      hash: '0x123456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    // Factory contract behavior
    factoryContract.createQuiz = jest.fn().mockResolvedValue({
      hash: '0xabcdef',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
  });

  test('Should handle non-standard ERC-20 tokens with fee-on-transfer', async () => {
    // Mock a fee-on-transfer token (takes 5% fee on each transfer)
    const FEE_PERCENTAGE = 5;
    
    // Override the token transfer behavior
    tokenContract.transfer = jest.fn().mockImplementation(async (to, amount) => {
      // Calculate fee
      const fee = amount.mul(FEE_PERCENTAGE).div(100);
      const actualTransferAmount = amount.sub(fee);
      
      console.log(`Transfer requested: ${amount}, Actual transfer after fee: ${actualTransferAmount}`);
      
      return {
        hash: '0x123456',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      };
    });
    
    // Create a function to detect and handle fee-on-transfer tokens
    const createQuizWithFeeDetection = async (params) => {
      const originalAmount = ethers.utils.parseUnits(params.tokenAmount, 18);
      
      // First check if this is a fee-on-transfer token by doing a test transfer to self
      const senderAddress = await signer.getAddress();
      const initialBalance = await tokenContract.balanceOf(senderAddress);
      
      // Mock a small test transfer to detect fees
      const testAmount = ethers.utils.parseUnits('1', 18);
      await tokenContract.transfer(senderAddress, testAmount);
      
      // Check balance after transfer
      const newBalance = await tokenContract.balanceOf(senderAddress);
      const expectedBalance = initialBalance; // Should be the same since we're transferring to self
      
      // If balance difference shows a fee was taken
      if (!newBalance.eq(expectedBalance)) {
        const actualReceived = newBalance.sub(initialBalance.sub(testAmount));
        const feePercentage = testAmount.sub(actualReceived).mul(100).div(testAmount);
        
        console.log(`Detected fee-on-transfer token with fee: ${feePercentage}%`);
        
        // Adjust the amount to account for the fee
        const adjustedAmount = originalAmount.mul(100).div(100 - feePercentage.toNumber());
        console.log(`Adjusting send amount from ${originalAmount} to ${adjustedAmount}`);
        
        // Use adjusted amount for the quiz
        params.tokenAmount = ethers.utils.formatUnits(adjustedAmount, 18);
      }
      
      // Now create the quiz with potentially adjusted amount
      return createQuizEscrow(
        params.tokenAddress,
        params.tokenAmount,
        params.quizId,
        params.quizDeadline,
        provider,
        signer,
        params.chainId
      );
    };
    
    const quizParams = {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenAmount: '10000',
      quizId: 'fee-token-test',
      quizDeadline: Math.floor(Date.now() / 1000) + 86400,
      chainId: 8453
    };
    
    // Execute with fee detection
    const result = await createQuizWithFeeDetection(quizParams);
    
    // Verify that the amount was adjusted
    expect(tokenContract.transfer).toHaveBeenCalled();
    // The final transfer amount should reflect the adjustment for fees
    const lastCallAmount = tokenContract.transfer.mock.calls[tokenContract.transfer.mock.calls.length - 1][1];
    const originalAmount = ethers.utils.parseUnits('10000', 18);
    const expectedAdjustedAmount = originalAmount.mul(100).div(100 - FEE_PERCENTAGE);
    
    // Check that the adjusted amount is close to expected (may have small rounding differences)
    const difference = expectedAdjustedAmount.sub(lastCallAmount).abs();
    const tolerance = ethers.utils.parseUnits('1', 10); // Allow for small rounding errors
    
    expect(difference.lte(tolerance)).toBe(true);
  });

  test('Should handle deflationary tokens that burn on transfer', async () => {
    // Mock a deflationary token (burns 2% on transfer)
    const BURN_PERCENTAGE = 2;
    
    // Track token balances
    let tokenBalances = new Map();
    tokenBalances.set(await signer.getAddress(), ethers.utils.parseUnits('1000', 18));
    
    // Override balance and transfer behavior
    tokenContract.balanceOf = jest.fn().mockImplementation(async (address) => {
      return tokenBalances.get(address) || ethers.BigNumber.from(0);
    });
    
    tokenContract.transfer = jest.fn().mockImplementation(async (to, amount) => {
      // Calculate burn amount
      const burnAmount = amount.mul(BURN_PERCENTAGE).div(100);
      const actualTransferAmount = amount.sub(burnAmount);
      
      // Update balances
      const sender = await signer.getAddress();
      const senderBalance = tokenBalances.get(sender) || ethers.BigNumber.from(0);
      const recipientBalance = tokenBalances.get(to) || ethers.BigNumber.from(0);
      
      tokenBalances.set(sender, senderBalance.sub(amount));
      tokenBalances.set(to, recipientBalance.add(actualTransferAmount));
      
      console.log(`Transfer: ${amount}, After burn: ${actualTransferAmount}, Total burned: ${burnAmount}`);
      
      return {
        hash: '0x123456',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      };
    });
    
    // Create a function that verifies sufficient balance considering burn
    const createQuizWithBurnCompensation = async (params) => {
      const tokenAmount = ethers.utils.parseUnits(params.tokenAmount, 18);
      const recipientAddress = factoryContract.address;
      
      // Calculate how much to send to ensure the contract receives exactly the amount needed
      // Formula: sendAmount = targetAmount / (1 - burnPercent/100)
      const sendAmount = tokenAmount.mul(100).div(100 - BURN_PERCENTAGE);
      
      // Check if we have enough balance
      const senderBalance = await tokenContract.balanceOf(await signer.getAddress());
      if (senderBalance.lt(sendAmount)) {
        throw new Error('Insufficient balance to cover burn amount');
      }
      
      console.log(`Required amount: ${tokenAmount}, Send amount with burn compensation: ${sendAmount}`);
      
      // Create quiz with the adjusted amount to compensate for burn
      return createQuizEscrow(
        params.tokenAddress,
        ethers.utils.formatUnits(sendAmount, 18),
        params.quizId,
        params.quizDeadline,
        provider,
        signer,
        params.chainId
      );
    };
    
    const quizParams = {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenAmount: '10000',
      quizId: 'deflationary-token-test',
      quizDeadline: Math.floor(Date.now() / 1000) + 86400,
      chainId: 8453
    };
    
    // Execute with burn compensation
    const result = await createQuizWithBurnCompensation(quizParams);
    
    // Verify the transfer was done with adjusted amount
    expect(tokenContract.transfer).toHaveBeenCalled();
    const transferAmount = tokenContract.transfer.mock.calls[0][1];
    const originalAmount = ethers.utils.parseUnits('10000', 18);
    const expectedAdjustedAmount = originalAmount.mul(100).div(100 - BURN_PERCENTAGE);
    
    expect(transferAmount.eq(expectedAdjustedAmount)).toBe(true);
    
    // Check the recipient received correct amount after burn
    const recipientBalance = await tokenContract.balanceOf(factoryContract.address);
    expect(recipientBalance.eq(originalAmount)).toBe(true);
  });

  test('Should handle tokens with EIP-2612 permit functionality', async () => {
    // Mock EIP-2612 permit functionality
    tokenContract.permit = jest.fn().mockResolvedValue({
      hash: '0x123permit',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    
    // Add interface detection
    const INTERFACE_IDS = {
      ERC20: '0x36372b07',
      ERC2612: '0x50bac753'
    };
    
    tokenContract.supportsInterface = jest.fn().mockImplementation(async (interfaceId) => {
      return interfaceId === INTERFACE_IDS.ERC20 || interfaceId === INTERFACE_IDS.ERC2612;
    });
    
    // Create helper for checking support for permit
    const detectPermitSupport = async (tokenAddress) => {
      try {
        // Try direct interface check
        if (await tokenContract.supportsInterface(INTERFACE_IDS.ERC2612)) {
          return true;
        }
      } catch (e) {
        // supportsInterface might not be implemented, try checking for permit function
        try {
          const code = await provider.getCode(tokenAddress);
          // Check if the code contains the permit function signature
          // 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'
          const permitFuncSig = 'd505accf';
          if (code.includes(permitFuncSig)) {
            return true;
          }
        } catch (err) {
          console.error('Error detecting permit support:', err);
        }
      }
      return false;
    };
    
    // Create a function that uses permit when available
    const createQuizWithPermit = async (params) => {
      const tokenAmount = ethers.utils.parseUnits(params.tokenAmount, 18);
      const senderAddress = await signer.getAddress();
      const spenderAddress = factoryContract.address;
      
      // Check if token supports permit
      const supportsPermit = await detectPermitSupport(params.tokenAddress);
      
      if (supportsPermit) {
        console.log('Token supports EIP-2612 permit, using gasless approval');
        
        // Get current chain nonce for the user
        const nonce = await provider.getTransactionCount(senderAddress);
        
        // Get chain ID from provider
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        
        // Create deadline for permit (1 hour from now)
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        
        // In a real implementation, we'd create and sign the permit message
        // For this mock, we'll just call the permit function directly
        await tokenContract.permit(
          senderAddress,
          spenderAddress,
          tokenAmount,
          deadline,
          27, // v
          '0x1234567890123456789012345678901234567890123456789012345678901234', // r
          '0x1234567890123456789012345678901234567890123456789012345678901234'  // s
        );
        
        // Create quiz without needing to call approve
        return createQuizEscrow(
          params.tokenAddress,
          params.tokenAmount,
          params.quizId,
          params.quizDeadline,
          provider,
          signer,
          params.chainId,
          { skipApproval: true } // Option to skip approval since we used permit
        );
      } else {
        console.log('Token does not support permit, using traditional approval');
        // Fall back to standard approve + transfer
        return createQuizEscrow(
          params.tokenAddress,
          params.tokenAmount,
          params.quizId,
          params.quizDeadline,
          provider,
          signer,
          params.chainId
        );
      }
    };
    
    const quizParams = {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenAmount: '10000',
      quizId: 'permit-token-test',
      quizDeadline: Math.floor(Date.now() / 1000) + 86400,
      chainId: 8453
    };
    
    // Execute with permit support detection
    const result = await createQuizWithPermit(quizParams);
    
    // Verify permit was called instead of approve
    expect(tokenContract.permit).toHaveBeenCalled();
    expect(tokenContract.approve).not.toHaveBeenCalled();
  });

  test('Should handle tokens with unusual decimals', async () => {
    // Test tokens with various decimal representations
    const tokenDecimals = [6, 8, 9, 12, 18, 24];
    
    for (const decimals of tokenDecimals) {
      // Update token decimals
      tokenContract.decimals = jest.fn().mockResolvedValue(decimals);
      
      const quizParams = {
        tokenAddress: `0x123456789012345678901234567890123456${decimals.toString().padStart(4, '0')}`,
        tokenAmount: '10000',
        quizId: `decimals-${decimals}-test`,
        quizDeadline: Math.floor(Date.now() / 1000) + 86400,
        chainId: 8453
      };
      
      // Helper that correctly handles token decimals
      const createQuizWithCorrectDecimals = async (params) => {
        // Detect token decimals first
        const tokenDecimals = await tokenContract.decimals();
        
        // Convert amount based on actual token decimals
        const tokenAmount = ethers.utils.parseUnits(params.tokenAmount, tokenDecimals);
        
        console.log(`Creating quiz with ${params.tokenAmount} tokens (${tokenDecimals} decimals)`);
        
        // Use the properly scaled amount
        return createQuizEscrow(
          params.tokenAddress,
          params.tokenAmount,
          params.quizId,
          params.quizDeadline,
          provider,
          signer,
          params.chainId
        );
      };
      
      // Execute with correct decimal handling
      await createQuizWithCorrectDecimals(quizParams);
      
      // Verify approvals are done with correct decimal precision
      expect(tokenContract.approve).toHaveBeenCalled();
      const approveAmount = tokenContract.approve.mock.calls[tokenContract.approve.mock.calls.length - 1][1];
      const expectedAmount = ethers.utils.parseUnits('10000', decimals);
      
      expect(approveAmount.eq(expectedAmount)).toBe(true);
    }
  });
});
