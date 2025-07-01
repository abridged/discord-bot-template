# Complete Discord Bot Multi-Agent Architecture Design Specification

## Project Overview
This design document outlines a comprehensive Discord bot architecture that utilizes a multi-agent approach to provide Web3 community management capabilities. The bot is initially implemented as a monolith for development speed but designed to be decomposed into specialized agents.

## Command Structure

### Base Command
```
/mother [domain] [action] [parameters...]
```

### Domain-Based Organization (as Subcommand Groups)
1. **community** - Community management & engagement
2. **token** - Token creation, distribution & management
3. **learn** - Educational content & quizzes
4. **trade** - Trading tools & market data
5. **defi** - DeFi protocols & yield strategies
6. **dao** - Governance & voting mechanisms
7. **nft** - NFT creation & management
8. **analytics** - Data insights & reporting

### Standard Actions (as Subcommands)
Each domain implements consistent action verbs:
- **create** - Generate new content/resources
- **view** - Display information
- **manage** - Modify existing resources
- **analyze** - Provide insights and data analysis

### Complete Command Structure Example
```
/mother community
  ├── create-poll [question] [options] [duration]
  ├── create-event [title] [time] [description]
  ├── manage-roles [action] [role] [criteria]
  └── analyze-engagement [period] [channel]

/mother token
  ├── design [supply] [distribution]
  ├── launch [parameters] [distribution-method]
  ├── airdrop [amount] [criteria]
  └── analyze-metrics [token-address]

/mother learn
  ├── create-quiz [url] [token] [amount]
  ├── create-lesson [topic] [format]
  ├── create-faq [source-url]
  └── view-resources [topic]

/mother trade
  ├── view-chart [token] [timeframe]
  ├── set-alert [token] [condition] [price]
  ├── view-orderbook [pair]
  └── analyze-volume [token] [period]

/mother defi
  ├── view-apr [protocol] [pool]
  ├── analyze-strategy [parameters]
  ├── estimate-yield [amount] [strategy]
  └── manage-position [protocol] [action]

/mother dao
  ├── create-proposal [title] [description] [options]
  ├── vote [proposal-id] [choice]
  ├── delegate [address]
  └── view-results [proposal-id]

/mother nft
  ├── create-collection [name] [supply]
  ├── mint [collection] [recipient] [quantity]
  ├── view-stats [collection]
  └── create-drop [collection] [criteria]

/mother analytics
  ├── view-growth [period] [metric]
  ├── create-report [metrics] [period]
  ├── track-onboarding [period]
  └── analyze-sentiment [channel] [period]
```

## On-Chain Multi-Agent Fee Distribution

### Agent Factory Contract Design
```solidity
contract AgentFactory {
    address public orchestratorWallet;
    address public accountKitFeeWallet;
    
    uint256 public orchestratorFeePercentage; // e.g., 5% = 500
    uint256 public accountKitFeePercentage;   // e.g., 2% = 200
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    constructor(
        address _orchestratorWallet, 
        address _accountKitFeeWallet,
        uint256 _orchestratorFeePercentage,
        uint256 _accountKitFeePercentage
    ) {
        orchestratorWallet = _orchestratorWallet;
        accountKitFeeWallet = _accountKitFeeWallet;
        orchestratorFeePercentage = _orchestratorFeePercentage;
        accountKitFeePercentage = _accountKitFeePercentage;
    }
    
    function createAndFundQuiz(
        address tokenAddress, 
        uint256 totalAmount,
        bytes32 quizDataHash
    ) external returns (address) {
        // 1. Calculate fees
        uint256 accountKitFee = (totalAmount * accountKitFeePercentage) / FEE_DENOMINATOR;
        uint256 orchestratorFee = (totalAmount * orchestratorFeePercentage) / FEE_DENOMINATOR;
        uint256 quizAmount = totalAmount - (accountKitFee + orchestratorFee);
        
        // 2. Transfer Account Kit fee
        require(
            IERC20(tokenAddress).transferFrom(msg.sender, accountKitFeeWallet, accountKitFee),
            "Failed to transfer Account Kit fee"
        );
        
        // 3. Transfer orchestrator fee
        require(
            IERC20(tokenAddress).transferFrom(msg.sender, orchestratorWallet, orchestratorFee),
            "Failed to transfer orchestrator fee"
        );
        
        // 4. Calculate deterministic address using CREATE2
        bytes32 salt = keccak256(abi.encodePacked(
            msg.sender,    // creator 
            quizDataHash,  // unique quiz content
            block.timestamp // prevent collision
        ));
        
        // 5. Deploy the quiz contract
        QuizEscrow quizContract = new QuizEscrow{salt: salt}(
            tokenAddress,
            msg.sender,  // quiz creator
            quizDataHash
        );
        
        // 6. Transfer funds to quiz contract
        require(
            IERC20(tokenAddress).transferFrom(msg.sender, address(quizContract), quizAmount),
            "Failed to transfer quiz funds"
        );
        
        // 7. Initialize quiz contract
        quizContract.initialize(quizAmount);
        
        // 8. Register quiz in registry
        quizRegistry[quizDataHash] = address(quizContract);
        
        emit QuizCreated(
            msg.sender,
            address(quizContract),
            quizDataHash,
            tokenAddress,
            accountKitFee,
            orchestratorFee,
            quizAmount
        );
        
        return address(quizContract);
    }
}

contract QuizEscrow {
    address public creator;
    address public tokenAddress;
    bytes32 public quizDataHash;
    uint256 public totalAmount;
    bool public initialized = false;
    
    constructor(
        address _tokenAddress,
        address _creator,
        bytes32 _quizDataHash
    ) {
        tokenAddress = _tokenAddress;
        creator = _creator;
        quizDataHash = _quizDataHash;
    }
    
    function initialize(uint256 _totalAmount) external {
        require(!initialized, "Already initialized");
        require(msg.sender == address(factory), "Only factory can initialize");
        totalAmount = _totalAmount;
        initialized = true;
    }
    
    // Quiz reward distribution functions...
}
```

### Benefits of Factory Contract Design
1. Single transaction for users
2. Transparent fee structure
3. CREATE2 for deterministic addresses
4. Gas-efficient operations
5. Clear separation of agent responsibilities

## Role-Based Permission System

### Permission Implementation
```javascript
// Permission configuration mapping subcommand groups to roles
const commandPermissions = {
  'community': {
    'create-poll': ['Admin', 'Moderator', 'CommunityManager'],
    'create-event': ['Admin', 'EventCoordinator'],
    'manage-roles': ['Admin'],
    'analyze-engagement': ['Admin', 'CommunityAnalyst']
  },
  'token': {
    'design': ['Admin', 'TokenManager'],
    'launch': ['Admin'],
    'airdrop': ['Admin', 'TokenManager'],
    'analyze-metrics': ['Admin', 'TokenManager', 'Analyst']
  },
  // Additional domain permissions...
};

// In command handler
function checkPermission(interaction, subcommandGroup, subcommand) {
  const requiredRoles = commandPermissions[subcommandGroup]?.[subcommand] || ['Admin'];
  
  return interaction.member.roles.cache.some(role => 
    requiredRoles.includes(role.name)
  );
}
```

## Integration with Account Kit

### User Flow
1. User triggers `/mother` command with appropriate subcommands
2. Bot calculates fees and presents breakdown to user
3. User approves transaction via Account Kit SDK
4. Factory contract receives funds and distributes them appropriately
5. Specialized contract (quiz/poll/etc) is deployed with remaining funds

### Fee Display Example
```
🏆 New Quiz: "Ethereum Basics"

💰 Token: USDC
💸 Total Amount: 100 USDC

Fee Breakdown:
- Account Kit Fee: 2 USDC (2%)
- Mother Agent Fee: 5 USDC (5%)
- Quiz Rewards Pool: 93 USDC (93%)

Press ✅ to approve this transaction
```

## Multi-Agent Architecture Transition Plan

### Phase 1: Monolithic Implementation
- Single codebase with clear domain boundaries
- Unified `/mother` command with all subcommand groups
- Internal fee tracking with no on-chain distribution

### Phase 2: Module with API Interface
- Refactor domains into separate modules
- Implement standardized internal APIs
- Create shared permission and configuration systems

### Phase 3: External Agent Decomposition
- Extract each domain module into independent agents
- Implement orchestrator contract for fee distribution
- Convert internal APIs to external agent protocols

### Final Architecture
- **Orchestrator Agent**: Handles command routing, fee collection
- **Domain-Specific Agents**: Specialized for each subcommand group
- **Common Infrastructure**: Shared permissions, analytics, UI formatting

## Discord Constraints to Consider
- Maximum 25 subcommand groups per command
- Maximum 25 subcommands per subcommand group
- Maximum 25 options per subcommand
- 100 global application commands per bot
- Command names limited to 1-32 characters
- Command descriptions limited to 1-100 characters

This architecture allows for a seamless user experience while supporting the technical evolution from monolith to multi-agent system, with appropriate fee distribution to sustain each agent in the ecosystem.
