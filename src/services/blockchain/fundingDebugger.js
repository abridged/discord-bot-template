/**
 * Funding Debugger Service
 * 
 * This service provides enhanced logging and verification for blockchain token transfers
 * related to quiz funding.
 */

const { ethers } = require('ethers');
const ERC20ABI = require('../../../contracts/artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json').abi;
// STUB: Use simple ABI to prevent import errors during contract rewrite
const QuizEscrowABI = [
  'function tokenAddress() view returns (address)',
  'function rewardAmount() view returns (uint256)',
  'function getParticipants() view returns (address[])'
];

class FundingDebugger {
  constructor(provider) {
    this.provider = provider || new ethers.providers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );
  }

  /**
   * Log detailed information about the token allowance
   * @param {string} tokenAddress - Address of the ERC20 token
   * @param {string} ownerAddress - Address of the token owner
   * @param {string} spenderAddress - Address of the spender (usually the factory)
   */
  async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    try {
      console.log('\n============== TOKEN ALLOWANCE CHECK ==============');
      console.log(`Token Address: ${tokenAddress}`);
      console.log(`Owner: ${ownerAddress}`);
      console.log(`Spender: ${spenderAddress}`);

      const token = new ethers.Contract(tokenAddress, ERC20ABI, this.provider);
      
      // Get token details
      const symbol = await token.symbol().catch(() => 'Unknown');
      const decimals = await token.decimals().catch(() => 18);
      
      // Get allowance
      const allowance = await token.allowance(ownerAddress, spenderAddress);
      
      console.log(`Token Symbol: ${symbol}`);
      console.log(`Token Decimals: ${decimals}`);
      console.log(`Current Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
      console.log(`Raw Allowance: ${allowance.toString()}`);
      
      return {
        symbol,
        decimals,
        allowance: allowance.toString()
      };
    } catch (error) {
      console.error('Error checking token allowance:', error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Log detailed information about the token balance
   * @param {string} tokenAddress - Address of the ERC20 token
   * @param {string} accountAddress - Address to check balance for
   */
  async checkBalance(tokenAddress, accountAddress) {
    try {
      console.log('\n============== TOKEN BALANCE CHECK ==============');
      console.log(`Token Address: ${tokenAddress}`);
      console.log(`Account: ${accountAddress}`);

      const token = new ethers.Contract(tokenAddress, ERC20ABI, this.provider);
      
      // Get token details
      const symbol = await token.symbol().catch(() => 'Unknown');
      const decimals = await token.decimals().catch(() => 18);
      
      // Get balance
      const balance = await token.balanceOf(accountAddress);
      
      console.log(`Token Symbol: ${symbol}`);
      console.log(`Token Decimals: ${decimals}`);
      console.log(`Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
      console.log(`Raw Balance: ${balance.toString()}`);
      
      return {
        symbol,
        decimals,
        balance: balance.toString()
      };
    } catch (error) {
      console.error('Error checking token balance:', error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Track a token transfer event
   * @param {string} tokenAddress - Address of the ERC20 token
   * @param {string} fromBlock - Block to start scanning from (can be number or 'latest')
   * @param {string} senderAddress - Optional filter for sender address
   * @param {string} receiverAddress - Optional filter for receiver address
   */
  async trackTransfers(tokenAddress, fromBlock, senderAddress, receiverAddress) {
    try {
      console.log('\n============== TOKEN TRANSFER TRACKER ==============');
      console.log(`Token Address: ${tokenAddress}`);
      console.log(`From Block: ${fromBlock}`);
      if (senderAddress) console.log(`Sender Filter: ${senderAddress}`);
      if (receiverAddress) console.log(`Receiver Filter: ${receiverAddress}`);

      const token = new ethers.Contract(tokenAddress, ERC20ABI, this.provider);
      
      // Create filter for Transfer events
      const filter = token.filters.Transfer(
        senderAddress || null,
        receiverAddress || null
      );
      
      // Get events
      const events = await token.queryFilter(filter, fromBlock);
      
      console.log(`Found ${events.length} transfer events`);
      
      // Get token details for formatting
      let symbol = 'Unknown';
      let decimals = 18;
      try {
        symbol = await token.symbol();
        decimals = await token.decimals();
      } catch (e) {
        console.warn('Could not get token details:', e.message);
      }
      
      // Process events
      const transfers = [];
      for (const event of events) {
        const { from, to, value } = event.args;
        const formattedValue = ethers.utils.formatUnits(value, decimals);
        
        const transfer = {
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          from,
          to,
          value: value.toString(),
          formattedValue,
          symbol
        };
        
        transfers.push(transfer);
        
        console.log(`\nTransaction: ${transfer.txHash}`);
        console.log(`Block: ${transfer.blockNumber}`);
        console.log(`From: ${transfer.from}`);
        console.log(`To: ${transfer.to}`);
        console.log(`Amount: ${transfer.formattedValue} ${transfer.symbol}`);
      }
      
      return transfers;
    } catch (error) {
      console.error('Error tracking token transfers:', error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Verify an escrow contract is correctly funded
   * @param {string} escrowAddress - Address of the quiz escrow
   * @param {string} expectedAmount - Expected token amount
   */
  async verifyEscrowFunding(escrowAddress, expectedAmount) {
    try {
      console.log('\n============== ESCROW FUNDING VERIFICATION ==============');
      console.log(`Escrow Address: ${escrowAddress}`);
      console.log(`Expected Amount: ${expectedAmount}`);

      // First check if there's code at the address
      const code = await this.provider.getCode(escrowAddress);
      if (code === '0x') {
        console.log('❌ No contract found at escrow address');
        return { exists: false };
      }
      
      console.log('✅ Escrow contract exists');
      
      // Connect to escrow contract
      const escrow = new ethers.Contract(escrowAddress, QuizEscrowABI, this.provider);
      
      // Get contract details
      const quizId = await escrow.quizId();
      const tokenAddress = await escrow.tokenAddress();
      const rewardAmount = await escrow.rewardAmount();
      const expiryTime = await escrow.expiryTime();
      const creator = await escrow.creator();
      
      console.log(`Quiz ID: ${quizId}`);
      console.log(`Token Address: ${tokenAddress}`);
      console.log(`Contract Reward Amount: ${rewardAmount.toString()}`);
      console.log(`Expiry Time: ${new Date(expiryTime.toNumber() * 1000).toISOString()}`);
      console.log(`Creator: ${creator}`);
      
      // Check actual token balance
      const token = new ethers.Contract(tokenAddress, ERC20ABI, this.provider);
      const symbol = await token.symbol().catch(() => 'Unknown');
      const decimals = await token.decimals().catch(() => 18);
      const escrowBalance = await token.balanceOf(escrowAddress);
      
      const formattedBalance = ethers.utils.formatUnits(escrowBalance, decimals);
      const formattedReward = ethers.utils.formatUnits(rewardAmount, decimals);
      
      console.log(`\nToken: ${symbol} (${decimals} decimals)`);
      console.log(`Escrow Balance: ${formattedBalance} ${symbol}`);
      console.log(`Required Amount: ${formattedReward} ${symbol}`);
      
      // Compare with expected amount
      const expectedBN = ethers.BigNumber.from(expectedAmount);
      const isFunded = escrowBalance.gte(expectedBN);
      
      if (isFunded) {
        console.log('✅ ESCROW IS FULLY FUNDED');
      } else {
        console.log('❌ ESCROW IS NOT FULLY FUNDED');
        console.log(`Missing: ${ethers.utils.formatUnits(expectedBN.sub(escrowBalance), decimals)} ${symbol}`);
      }
      
      // Check if escrow matches contract required amount
      const matchesContract = rewardAmount.eq(expectedBN);
      if (!matchesContract) {
        console.log(`⚠️ WARNING: Expected amount (${expectedBN.toString()}) doesn't match contract amount (${rewardAmount.toString()})`);
      }
      
      return {
        exists: true,
        quizId,
        tokenAddress,
        rewardAmount: rewardAmount.toString(),
        escrowBalance: escrowBalance.toString(),
        isFunded,
        matchesContract,
        expiryTime: expiryTime.toNumber(),
        creator
      };
    } catch (error) {
      console.error('Error verifying escrow funding:', error.message);
      return {
        error: error.message
      };
    }
  }
}

module.exports = FundingDebugger;
