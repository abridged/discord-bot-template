# Integrating ERC-7702, ERC-7521, and ERC-7715 with Collab.Land Account Kit for Discord Bots

*Date: June 7, 2025*

## Overview

This document provides a comprehensive guide on integrating three complementary Ethereum standards (ERC-7702, ERC-7521, and ERC-7715) with Collab.Land Account Kit to create a seamless user experience in Discord bots. By combining these standards, we can create a powerful system that works across all wallet types and provides advanced features like gasless transactions, batched operations, and simple token transfers.

## Reference Documents

This integration guide builds upon the following detailed specifications:

1. [ERC-7702: Account Abstraction Via Alternative Mempool](/Users/abridged/projects/discord-bot-template/context/notes/2025-06-07-erc-7702.md)
2. [ERC-7521: Generalized Intents for Smart Contract Wallets](/Users/abridged/projects/discord-bot-template/context/notes/2025-06-07-erc-7521.md)
3. [ERC-7710: Smart Contract Delegation](/Users/abridged/projects/discord-bot-template/context/notes/2025-06-07-erc-7710.md)
4. [ERC-7715: Intent for Token Transfers](/Users/abridged/projects/discord-bot-template/context/notes/2025-06-07-erc-7715.md)

## Integration Architecture

### 1. Unified System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│                 │     │                  │     │                     │
│  Discord Bot    │────▶│  Account Kit SDK │────▶│  Intent Management  │
│                 │     │                  │     │                     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                           │
                                                           ▼
                           ┌───────────────────────────────────────────────┐
                           │                                               │
                           │                Wallet Type?                   │
                           │                                               │
                           └───────────────────────────────────────────────┘
                                    /                             \
                                   /                               \
                                  ▼                                ▼
┌─────────────────────────────────────┐            ┌─────────────────────────────────┐
│                                     │            │                                 │
│     Smart Account Path (Direct)     │            │       EOA Path (via 7702)       │
│                                     │            │                                 │
└─────────────────────────────────────┘            └─────────────────────────────────┘
                  │                                                │
                  ▼                                                ▼
┌─────────────────────────────────────┐            ┌─────────────────────────────────┐
│                                     │            │                                 │
│   ERC-7521/7715 Intent Submission   │            │   ERC-7702 UserOp Submission    │
│                                     │            │                                 │
└─────────────────────────────────────┘            └─────────────────────────────────┘
                  │                                                │
                  └────────────────────┬───────────────────────────┘
                                       ▼
                         ┌─────────────────────────────┐
                         │                             │
                         │  On-Chain Intent Execution  │
                         │                             │
                         └─────────────────────────────┘
```

### 2. Core Integration Components

1. **Wallet Detection & Handling Layer**
   - Identifies wallet type (EOA or Smart Account)
   - Routes operations through appropriate path
   - Maintains consistent user experience

2. **Intent Creation Layer**
   - Translates Discord commands to intent structures
   - Handles token transfer specifics via ERC-7715
   - Creates appropriate action sequences

3. **Execution Layer**
   - Submits intents directly for smart accounts
   - Routes through ERC-7702 bundler for EOAs
   - Monitors transaction status

4. **UI/UX Layer**
   - Displays intent details in Discord
   - Shows fee breakdowns
   - Provides transaction status updates

## Implementation Guide

### 1. Account Kit SDK Integration

```javascript
class AccountKitIntegration {
    constructor(config) {
        this.accountKit = new CollabLandAccountKit(config);
        this.intentRegistry = new IntentRegistry();
        this.bundlerService = new ERC7702BundlerService(config.bundlerUrl);
    }
    
    async connect(userId, provider) {
        return this.accountKit.connectWallet(userId, provider);
    }
    
    async getWallet(userId) {
        return this.accountKit.getWalletForUser(userId);
    }
    
    async isSmartAccount(address) {
        return this.accountKit.isSmartContractWallet(address);
    }
    
    async createAndExecuteIntent(userId, intentType, params) {
        // Get user wallet
        const wallet = await this.getWallet(userId);
        if (!wallet) throw new Error('No wallet connected');
        
        // Create intent based on type
        const intent = await this.createIntent(intentType, {
            ...params,
            senderAddress: wallet.address
        });
        
        // Check if smart account or EOA
        const isSmartAccount = await this.isSmartAccount(wallet.address);
        
        if (isSmartAccount) {
            // Handle as direct intent for smart accounts
            return this.executeIntentDirectly(intent, wallet);
        } else {
            // Handle as UserOperation for EOAs
            return this.executeIntentViaUserOp(intent, wallet);
        }
    }
    
    async createIntent(intentType, params) {
        // Intent factory pattern based on type
        switch (intentType) {
            case 'TOKEN_TRANSFER':
                return this.intentRegistry.createTokenTransferIntent(params);
            case 'QUIZ_CREATION':
                return this.intentRegistry.createQuizIntent(params);
            // Other intent types...
            default:
                throw new Error(`Unsupported intent type: ${intentType}`);
        }
    }
    
    async executeIntentDirectly(intent, wallet) {
        // Sign and submit intent directly
        const signedIntent = await this.accountKit.signIntent(intent, wallet);
        return this.accountKit.submitIntent(signedIntent);
    }
    
    async executeIntentViaUserOp(intent, wallet) {
        // Convert intent to ERC-7702 UserOperation
        const userOp = this.bundlerService.createUserOperationFromIntent(
            intent,
            wallet.address
        );
        
        // Sign UserOperation
        const signedUserOp = await this.accountKit.signUserOperation(userOp, wallet);
        
        // Submit to bundler
        return this.bundlerService.submitUserOperation(signedUserOp);
    }
}
```

### 2. Discord Bot Command Integration

```javascript
// Command registration
const commands = [
    {
        name: 'create-quiz',
        description: 'Create a new quiz with token rewards',
        options: [
            {
                name: 'url',
                description: 'URL to generate quiz from',
                type: 3, // STRING
                required: true
            },
            {
                name: 'token',
                description: 'Token address for rewards',
                type: 3, // STRING
                required: true
            },
            {
                name: 'amount',
                description: 'Total amount of tokens for rewards',
                type: 3, // STRING
                required: true
            }
        ]
    },
    // Other commands...
];

// Command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    
    if (commandName === 'create-quiz') {
        await handleCreateQuiz(interaction);
    }
    // Other command handlers...
});

// Quiz creation handler
async function handleCreateQuiz(interaction) {
    try {
        // Extract parameters
        const url = interaction.options.getString('url');
        const token = interaction.options.getString('token');
        const amount = interaction.options.getString('amount');
        
        // Initialize Account Kit integration
        const accountKit = new AccountKitIntegration(config);
        
        // Generate quiz content
        const quizContent = await generateQuizFromUrl(url);
        const quizDataHash = ethers.utils.id(JSON.stringify(quizContent));
        
        // Calculate fees
        const parsedAmount = ethers.utils.parseUnits(amount, 18); // Assuming 18 decimals
        const accountKitFee = parsedAmount.mul(200).div(10000); // 2%
        const orchestratorFee = parsedAmount.mul(500).div(10000); // 5%
        const quizAmount = parsedAmount.sub(accountKitFee).sub(orchestratorFee);
        
        // Show fee breakdown to user
        await interaction.reply({
            content: `
            🏆 New Quiz: "${quizContent.title}"
            
            💰 Total Amount: ${amount} tokens
            
            Fee Breakdown:
            - Account Kit Fee: ${ethers.utils.formatUnits(accountKitFee, 18)} (2%)
            - Orchestrator Fee: ${ethers.utils.formatUnits(orchestratorFee, 18)} (5%)
            - Quiz Rewards: ${ethers.utils.formatUnits(quizAmount, 18)} (93%)
            
            Click below to approve this transaction.
            `,
            components: [/* approval button */],
            ephemeral: true
        });
        
        // Handle user approval
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'approve_quiz' && i.user.id === interaction.user.id,
            time: 60000,
            max: 1
        });
        
        collector.on('collect', async i => {
            await i.update({ content: 'Processing transaction...', components: [] });
            
            // Create and execute intent
            const result = await accountKit.createAndExecuteIntent(
                interaction.user.id,
                'QUIZ_CREATION',
                {
                    token,
                    quizDataHash,
                    totalAmount: parsedAmount,
                    accountKitFee,
                    orchestratorFee,
                    quizAmount
                }
            );
            
            if (result.success) {
                await interaction.followUp({
                    content: 'Quiz created successfully!',
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: `Failed to create quiz: ${result.error}`,
                    ephemeral: true
                });
            }
        });
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'An error occurred while creating the quiz.',
            ephemeral: true
        });
    }
}
```

### 3. Smart Contract Integration

```solidity
// Combined handler supporting all three standards
contract IntegratedIntentHandler is IIntentHandler, ITokenTransferHandler, IERC7702Handler {
    // Intent handling (ERC-7521)
    function handleIntent(Intent calldata intent) external override returns (bool) {
        // Intent validation and execution
        // ...
    }
    
    // Token transfer handling (ERC-7715)
    function handleTokenTransfer(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes calldata data
    ) external override returns (bool) {
        // Token transfer execution
        // ...
    }
    
    // UserOperation handling (ERC-7702)
    function handleUserOperations(
        UserOperation[] calldata userOps
    ) external override returns (bool) {
        // Process user operations
        for (uint i = 0; i < userOps.length; i++) {
            _processUserOp(userOps[i]);
        }
        return true;
    }
    
    // Helper for converting UserOp to Intent
    function _processUserOp(UserOperation calldata userOp) internal {
        // Extract intent from UserOp and process
        // ...
    }
}
```

## Benefits of Combined Implementation

### 1. Wallet-Agnostic Experience

- **Universal Support**: Same features for EOA and Smart Account users
- **Transparent Handling**: Users don't need to know their wallet type
- **Progressive Adoption**: Start with EOA, upgrade to Smart Account later

### 2. Enhanced User Experience

- **One-Click Approvals**: Sign once for multiple operations
- **Clear Fee Structure**: Transparent breakdown of all fees
- **Gasless Transactions**: No ETH needed for most operations

### 3. Developer Benefits

- **Unified API**: One integration pattern for all wallet types
- **Simplified Error Handling**: Standardized error messages and recovery
- **Reduced Complexity**: Abstract away blockchain complexities

### 4. Discord Integration Features

- **Rich Embeds**: Display transaction details in Discord messages
- **Interactive Flows**: Button confirmations for transactions
- **Status Updates**: Real-time transaction status notifications

## Use Cases in Discord Bot Multi-Agent Architecture

### 1. Mother Agent (Orchestrator)

- Creates intents that distribute fees to specialized agents
- Uses ERC-7715 for token transfers to service providers
- Handles permission verification and access control

### 2. Quiz & Learning Agent

- Creates quiz contracts with token rewards
- Distributes rewards using intent-based transfers
- Tracks quiz completion and eligibility on-chain

### 3. Token Management Agent

- Handles token distribution and airdrops
- Creates multi-recipient transfer intents
- Manages token approvals and allowances

### 4. Community & Governance Agent

- Creates proposals and voting mechanisms
- Handles delegation and voting power
- Manages token-gated role assignments

## Implementation Roadmap

### Phase 1: Foundation
- Integrate Account Kit for wallet connection
- Implement basic intent creation for key operations
- Set up EOA compatibility via ERC-7702

### Phase 2: Enhanced Features
- Add specialized token operations using ERC-7715
- Implement transparent fee splitting
- Create domain-specific intent types for each agent

### Phase 3: Full Integration
- Deploy intent handler contracts
- Integrate bundler network for EOAs
- Implement cross-agent intent coordination

## Conclusion

By combining ERC-7702, ERC-7521, ERC-7710, and ERC-7715 with Collab.Land Account Kit, Discord bots can provide a seamless, wallet-agnostic experience for Web3 communities. This integration creates a powerful foundation for multi-agent architectures, simplifies complex blockchain interactions, and enables innovative features that would be difficult to implement with traditional transaction patterns.

The flexibility of intent-based operations, combined with the universal wallet support of ERC-7702, creates a system that can evolve alongside the Web3 ecosystem while maintaining backward compatibility with existing wallets and infrastructure.
