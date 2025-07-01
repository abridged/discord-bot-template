# Poll & Quiz On-chain Interaction Refactor

*Date: June 9, 2025*

This document outlines the architecture for integrating blockchain functionality with the Discord bot's poll and quiz systems using Collab.Land Account Kit and a factory contract pattern.

## System Overview

The updated architecture introduces blockchain capabilities to the existing poll and quiz functionality, leveraging smart contracts to:
- Securely manage rewards for participation
- Create transparent, immutable records of poll/quiz activities
- Automatically calculate and distribute fees
- Enable multi-chain and multi-token support

## Architecture Components

### 1. Discord Bot Interface

The Discord bot will expose the following commands:

```
/mother quiz create
  --url "https://my-llm-endpoint.com/quiz-generator"
  --token "0x1234..." (token address)
  --chain 1 (Ethereum Mainnet)
  --amount 100
  --reward_correct 5
  --reward_incorrect 1

/mother poll create
  --url "https://my-llm-endpoint.com/poll-generator" 
  --token "0x1234..." (token address)
  --chain 1 (Ethereum Mainnet)
  --amount 100
  --reward_participation 2
```

### 2. Smart Contract System

The smart contract architecture consists of:

- **Factory Contract**: Central registry and deployment mechanism for quiz and poll escrows
- **Quiz Escrow Contract**: Manages quiz rewards and participation
- **Poll Escrow Contract**: Handles poll vote tracking and rewards

All contracts utilize the EIP-1167 minimal proxy pattern for gas-efficient deployment.

### 3. Collab.Land Account Kit Integration

Collab.Land Account Kit handles:
- Wallet address resolution for Discord users
- Transaction signing and submission
- Multi-chain support
- ERC-20 token transfers

## User Flow Diagram

```
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ QUIZ/POLL CREATION  │      │ PARTICIPATION       │      │ REWARD DISTRIBUTION │
├─────────────────────┤      ├─────────────────────┤      ├─────────────────────┤
│                     │      │                     │      │                     │
│ 1. User calls       │      │ 4. Users take       │      │ 5. Bot calculates   │
│    /mother command  │──┐   │    quiz/poll        │──┐   │    rewards & sends  │
│                     │  │   │                     │  │   │    via Account Kit  │
│ 2. Bot generates    │  │   │                     │  │   │                     │
│    Discord message  │  │   │                     │  │   │ 6. Bot updates      │
│                     │  │   │                     │  │   │    quiz/poll status │
│ 3. Deploy escrow    │  │   │                     │  │   │    in Discord       │
│    via factory      │  │   │                     │  │   │                     │
└─────────────────────┘  │   └─────────────────────┘  │   └─────────────────────┘
                         │                            │
                         ▼                            ▼
              ┌─────────────────────┐      ┌─────────────────────┐
              │ COLLAB.LAND         │      │ FACTORY & ESCROW    │
              │ ACCOUNT KIT         │      │ CONTRACTS           │
              └─────────────────────┘      └─────────────────────┘
```

## Detailed Flow Sequence

### Quiz Creation

1. **Discord Interaction**:
   - User calls `/mother quiz create` with required parameters
   - Bot validates parameters and token compatibility

2. **Content Generation**:
   - Bot calls specified LLM endpoint to generate quiz content
   - Questions, options, and correct answers are stored with the bot

3. **Contract Deployment**:
   - Bot uses Account Kit to prepare factory contract transaction
   - Factory deploys quiz escrow proxy with specified parameters
   - 2% fee is automatically transferred to bot's wallet

4. **Discord Message**:
   - Bot creates interactive quiz message with:
     - Quiz title and description
     - Token information and total reward amount
     - Start button for users to participate

### Quiz Participation

1. **User Interaction**:
   - User clicks start button on quiz message
   - Bot presents questions sequentially in ephemeral messages

2. **Wallet Resolution**:
   - While user takes quiz, bot uses Account Kit to resolve user's wallet address

3. **Score Calculation**:
   - Bot calculates final score and eligible reward
   - Rewards can vary for correct and incorrect answers

4. **Reward Distribution**:
   - Bot uses Account Kit to send appropriate reward to user's wallet
   - Transaction is prepared based on quiz parameters and performance

5. **Interface Update**:
   - Quiz message updates to show participation count and remaining rewards

### Poll Creation & Participation

Similar to quiz flow, with adjustments:
- Poll options instead of quiz questions
- Single reward amount for participation (no correct/incorrect distinction)
- Voting results publicly visible

## Smart Contract Design

### Factory Contract

```solidity
// Core functionality only - not full implementation
contract PollQuizFactory {
    address public quizImplementation;
    address public pollImplementation;
    address public botWallet; // For fee collection
    uint256 public feeBps = 200; // 2% fee
    
    event QuizEscrowCreated(
        address indexed creator,
        address indexed escrowAddress,
        address tokenAddress,
        uint256 amount
    );
    
    event PollEscrowCreated(
        address indexed creator,
        address indexed escrowAddress,
        address tokenAddress,
        uint256 amount
    );
    
    constructor(
        address _quizImplementation,
        address _pollImplementation,
        address _botWallet
    ) {
        quizImplementation = _quizImplementation;
        pollImplementation = _pollImplementation;
        botWallet = _botWallet;
    }
    
    function createQuizEscrow(
        address tokenAddress,
        uint256 amount,
        uint256 rewardCorrect,
        uint256 rewardIncorrect
    ) external returns (address) {
        address escrow = Clones.clone(quizImplementation);
        
        QuizEscrow(escrow).initialize(
            msg.sender,
            tokenAddress,
            amount,
            rewardCorrect,
            rewardIncorrect,
            botWallet,
            feeBps
        );
        
        emit QuizEscrowCreated(msg.sender, escrow, tokenAddress, amount);
        return escrow;
    }
    
    function createPollEscrow(
        address tokenAddress,
        uint256 amount,
        uint256 rewardParticipation
    ) external returns (address) {
        address escrow = Clones.clone(pollImplementation);
        
        PollEscrow(escrow).initialize(
            msg.sender,
            tokenAddress,
            amount,
            rewardParticipation,
            botWallet,
            feeBps
        );
        
        emit PollEscrowCreated(msg.sender, escrow, tokenAddress, amount);
        return escrow;
    }
}
```

### Quiz Escrow Contract

```solidity
// Core functionality only - not full implementation
contract QuizEscrow {
    address public creator;
    address public tokenAddress;
    uint256 public totalAmount;
    uint256 public remainingAmount;
    uint256 public rewardCorrect;
    uint256 public rewardIncorrect;
    
    address public botWallet;
    uint256 public feeBps;
    bool public initialized = false;
    
    mapping(address => bool) public hasParticipated;
    mapping(address => bool) public hasClaimed;
    
    event Initialized(address creator, address tokenAddress, uint256 amount);
    event FeeCollected(address botWallet, uint256 feeAmount);
    event RewardPaid(address participant, uint256 amount, uint256 score);
    
    function initialize(
        address _creator,
        address _tokenAddress, 
        uint256 _amount,
        uint256 _rewardCorrect,
        uint256 _rewardIncorrect,
        address _botWallet,
        uint256 _feeBps
    ) external {
        require(!initialized, "Already initialized");
        
        creator = _creator;
        tokenAddress = _tokenAddress;
        totalAmount = _amount;
        rewardCorrect = _rewardCorrect;
        rewardIncorrect = _rewardIncorrect;
        botWallet = _botWallet;
        feeBps = _feeBps;
        
        // Calculate and transfer fee
        uint256 feeAmount = (_amount * _feeBps) / 10000;
        remainingAmount = _amount - feeAmount;
        
        // Transfer tokens from creator to this contract
        IERC20(tokenAddress).transferFrom(creator, address(this), _amount - feeAmount);
        
        // Transfer fee to bot wallet
        IERC20(tokenAddress).transferFrom(creator, botWallet, feeAmount);
        
        initialized = true;
        emit Initialized(creator, tokenAddress, _amount);
        emit FeeCollected(botWallet, feeAmount);
    }
    
    function payReward(
        address participant,
        uint256 score,
        uint256 totalQuestions,
        bytes calldata signature // For authorization
    ) external {
        require(initialized, "Not initialized");
        require(!hasParticipated[participant], "Already participated");
        require(verifySignature(participant, score, signature), "Invalid signature");
        
        hasParticipated[participant] = true;
        
        // Calculate reward based on score
        uint256 correctAnswers = score;
        uint256 incorrectAnswers = totalQuestions - score;
        
        uint256 totalReward = (correctAnswers * rewardCorrect) + (incorrectAnswers * rewardIncorrect);
        require(totalReward <= remainingAmount, "Insufficient funds");
        
        remainingAmount -= totalReward;
        
        // Transfer reward
        IERC20(tokenAddress).transfer(participant, totalReward);
        
        emit RewardPaid(participant, totalReward, score);
    }
    
    // Signature verification for bot authorization
    function verifySignature(
        address participant,
        uint256 score,
        bytes calldata signature
    ) internal view returns (bool) {
        // Implementation for signature verification
        // This ensures only the bot can authorize rewards
        return true; // Placeholder
    }
}
```

### Poll Escrow Contract

Similar to Quiz Escrow with simplified reward structure:
- Single reward amount for participation
- No scoring mechanism
- Vote counting functionality

## Collab.Land Account Kit Integration 

The Discord bot will use the Account Kit for:

1. **Wallet Resolution**:
```javascript
async function resolveUserWallet(discordUserId) {
  try {
    const accountKit = getAccountKitClient();
    return await accountKit.resolveWallet({
      userId: discordUserId,
      guildId: interaction.guildId
    });
  } catch (error) {
    console.error("Failed to resolve wallet:", error);
    return null;
  }
}
```

2. **Transaction Preparation**:
```javascript
async function prepareEscrowDeployment(
  creator, 
  tokenAddress, 
  amount, 
  rewardCorrect, 
  rewardIncorrect,
  chainId
) {
  const accountKit = getAccountKitClient();
  const tx = await accountKit.prepareTransaction({
    chainId: chainId,
    from: creator,
    to: FACTORY_CONTRACT_ADDRESS,
    data: encodeCreateQuizEscrow(
      tokenAddress,
      amount,
      rewardCorrect,
      rewardIncorrect
    )
  });
  
  return tx;
}
```

3. **Reward Distribution**:
```javascript
async function sendQuizReward(
  userDiscordId,
  escrowAddress,
  score,
  totalQuestions,
  chainId
) {
  const userWallet = await resolveUserWallet(userDiscordId);
  if (!userWallet) return false;
  
  const signature = await generateBotSignature(userWallet.address, score);
  
  const accountKit = getAccountKitClient();
  const tx = await accountKit.prepareTransaction({
    chainId: chainId,
    from: BOT_WALLET_ADDRESS,
    to: escrowAddress,
    data: encodePayReward(
      userWallet.address,
      score,
      totalQuestions,
      signature
    )
  });
  
  const receipt = await accountKit.sendTransaction(tx);
  return receipt;
}
```

## Database Schema Updates

The following database tables need updates to support blockchain integration:

### Quiz Table Extensions

```javascript
const Quiz = sequelize.define('Quiz', {
  // Existing fields
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  creatorId: { type: DataTypes.STRING, allowNull: false },
  
  // New blockchain fields
  tokenAddress: { type: DataTypes.STRING },
  chainId: { type: DataTypes.INTEGER },
  escrowAddress: { type: DataTypes.STRING },
  totalAmount: { type: DataTypes.STRING },
  rewardCorrect: { type: DataTypes.STRING },
  rewardIncorrect: { type: DataTypes.STRING },
  remainingAmount: { type: DataTypes.STRING }
});
```

### QuizAttempt Table Extensions

```javascript
const QuizAttempt = sequelize.define('QuizAttempt', {
  // Existing fields
  userId: { type: DataTypes.STRING, allowNull: false },
  quizId: { type: DataTypes.INTEGER, allowNull: false },
  score: { type: DataTypes.INTEGER },
  
  // New blockchain fields
  rewardAmount: { type: DataTypes.STRING },
  transactionHash: { type: DataTypes.STRING },
  walletAddress: { type: DataTypes.STRING }
});
```

Similar extensions for Poll and PollVote tables.

## Discord UI Updates

### Quiz Creation Modal

The quiz creation modal will be enhanced with:

1. **Token Selection**:
   - Dropdown for selecting token type (ETH, USDC, etc.)
   - Chain selection dropdown (Ethereum, Polygon, etc.)

2. **Reward Configuration**:
   - Total funding amount field
   - Reward per correct answer field
   - Reward per incorrect answer field (can be 0)

3. **Content Source**:
   - URL for LLM quiz content generation
   - Option to manually add questions

### Poll Creation Modal

Similar to quiz with:
1. Token and chain selection
2. Total funding amount
3. Reward per participant
4. Poll option configuration

### Quiz/Poll Display

The quiz/poll messages will display:
1. Token type and amount
2. Remaining rewards
3. Participation count
4. Transaction details (optional link)
5. Real-time updates as users participate

## Security Considerations

1. **Signature Verification**:
   - Escrow contracts verify bot signatures for reward distribution
   - Prevents unauthorized rewards

2. **Fee Protection**:
   - Factory enforces 2% fee collection on initialization
   - Fee recipient (bot wallet) can only be changed by contract owner

3. **Fund Protection**:
   - Escrow contracts enforce participation checks
   - Users can only claim rewards once

4. **Upgrade Path**:
   - Factory can be upgraded to support new features
   - Implementation contracts can be updated for new deployments

## Multi-Chain Support

The architecture supports multiple chains by:
1. Deploying factory contracts on each supported chain
2. Using the chainId parameter to determine the appropriate factory
3. Leveraging Collab.Land Account Kit's multi-chain capabilities

## Future Extensions

The design allows for future enhancements:

1. **Intuition Integration** (as documented previously):
   - Enhanced metadata for quizzes and polls
   - Identity verification between Discord and blockchain
   - Knowledge graph integration

2. **ERC-7710 Delegation**:
   - Support for smart contract delegation
   - Gasless transactions for participants

3. **ERC-7521 Intents**:
   - Intent-based interaction for improved UX
   - Conditional execution for advanced quiz/poll features

## Next Steps

1. **Contract Development**:
   - Implement factory and escrow contracts
   - Develop signature verification mechanism
   
2. **Bot Integration**:
   - Update Discord commands to support new parameters
   - Integrate with Account Kit for wallet resolution
   
3. **UI Development**:
   - Design and implement updated modals
   - Create blockchain-aware quiz/poll displays
   
4. **Testing**:
   - Test contract interactions on testnets
   - Verify reward distribution mechanisms
   - Simulate high-usage scenarios
