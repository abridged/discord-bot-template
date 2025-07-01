# Base Sepolia Development Checklist
## Mother Factory & QuizEscrow Implementation Pipeline

**Version**: 2025-06-16  
**Constraint**: Collab.Land Account Kit only supports Base Sepolia/Base Mainnet  
**Strategy**: Base Sepolia deployment before bot integration testing

---

## 📋 **Step 1: Contract Implementation & Local Testing**

### Prerequisites
- [ ] Hardhat environment configured
- [ ] Solidity version ^0.8.0 set
- [ ] OpenZeppelin contracts installed
- [ ] Test accounts configured

### Contract Implementation
- [ ] **ISimpleHandler.sol** - Handler interface
  - [ ] `deployContract(bytes calldata params)` function signature
  - [ ] `getDeploymentFee(bytes calldata params)` function signature
  - [ ] `getHandlerInfo()` function signature

- [ ] **QuizEscrow.sol** - Payment processor contract
  - [ ] Storage layout with immutable variables:
    - [ ] `authorizedBot` (immutable)
    - [ ] `creator` (immutable) 
    - [ ] `creationTime` (immutable)
    - [ ] `fundingAmount` (immutable)
    - [ ] `correctReward` (immutable)
    - [ ] `incorrectReward` (immutable)
  - [ ] Mutable storage:
    - [ ] `totalPaidOut`
    - [ ] `participantResults` mapping
    - [ ] `participantsList` array
    - [ ] Global stats counters
    - [ ] `isEnded` boolean
  - [ ] **Constructor** with bot authorization and funding
  - [ ] **recordQuizResult()** with `onlyAuthorizedBot` modifier
  - [ ] **endQuiz()** function for manual ending
  - [ ] View functions: `getParticipantResult()`, `getQuizStats()`, `getRemainingTime()`, `getAllParticipants()`
  - [ ] Events: `QuizCreated`, `QuizResultRecorded`, `QuizEnded`, `UnclaimedFundsReturned`

- [ ] **QuizHandler.sol** - Quiz deployment handler
  - [ ] Implements `ISimpleHandler` interface
  - [ ] `authorizedBot` immutable variable
  - [ ] `DEPLOYMENT_FEE` constant (0.001 ether)
  - [ ] `deployContract()` function that creates QuizEscrow
  - [ ] Parameter decoding for correctReward/incorrectReward
  - [ ] Fee handling (deployment fee vs quiz funding)

- [ ] **MotherFactory.sol** - Factory coordination contract
  - [ ] Handler registry mapping
  - [ ] Contract deployment tracking
  - [ ] `registerHandler()` function (owner only)
  - [ ] `deployContract()` function that delegates to handlers
  - [ ] `getDeploymentFee()` function that queries handlers
  - [ ] Events: `ContractDeployed`, `HandlerRegistered`

### Unit Testing
- [ ] **QuizEscrow Tests** (`test/QuizEscrow.test.js`)
  - [ ] ✅ Constructor sets parameters correctly
  - [ ] ✅ Only authorized bot can record results
  - [ ] ✅ Calculates and pays rewards correctly
  - [ ] ✅ Prevents double participation
  - [ ] ✅ Tracks global statistics correctly
  - [ ] ✅ Ends after 24 hours automatically
  - [ ] ✅ Returns unclaimed funds to creator
  - [ ] ✅ Emits all events correctly
  - [ ] ✅ Handles edge cases (insufficient funds, zero rewards)

- [ ] **QuizHandler Tests** (`test/QuizHandler.test.js`)
  - [ ] ✅ Deploys QuizEscrow with correct parameters
  - [ ] ✅ Handles deployment fee correctly
  - [ ] ✅ Returns correct deployment fee estimate
  - [ ] ✅ Validates parameters properly
  - [ ] ✅ Handles insufficient funding gracefully

- [ ] **MotherFactory Tests** (`test/MotherFactory.test.js`)
  - [ ] ✅ Registers handlers correctly (owner only)
  - [ ] ✅ Deploys contracts through handlers
  - [ ] ✅ Tracks deployed contracts
  - [ ] ✅ Queries deployment fees correctly
  - [ ] ✅ Handles unknown contract types
  - [ ] ✅ Emits events correctly

### Integration Testing
- [ ] **Factory-Handler-Escrow Integration** (`test/Integration.test.js`)
  - [ ] ✅ Complete deployment flow works
  - [ ] ✅ Quiz creation through factory works
  - [ ] ✅ Bot can record results on deployed quiz
  - [ ] ✅ Multiple quiz deployments work
  - [ ] ✅ Fee distribution works correctly

### Verification Commands
```bash
# Compilation
npx hardhat compile

# Unit tests
npx hardhat test

# Test coverage
npx hardhat coverage

# Static analysis (if configured)
npx hardhat run scripts/analyze.js
```

**Success Criteria**: ✅ All tests pass, >90% coverage, clean compilation

---

## 🌐 **Step 2: Base Sepolia Deployment**

### Environment Setup
- [ ] **Base Sepolia RPC configured** in `hardhat.config.js`
  - [ ] Network: `baseSepolia`
  - [ ] URL: `https://sepolia.base.org`
  - [ ] Chain ID: `84532`
  - [ ] Accounts: Private key configured
- [ ] **Environment variables set**:
  - [ ] `PRIVATE_KEY` - Deployer wallet
  - [ ] `BOT_WALLET_ADDRESS` - Authorized bot address
  - [ ] `BASESCAN_API_KEY` - For contract verification
- [ ] **Base Sepolia ETH** - Sufficient balance for deployment

### Deployment Scripts
- [ ] **deploy-base-sepolia.js** script created
  - [ ] Deploy MotherFactory
  - [ ] Deploy QuizHandler with bot address
  - [ ] Register QuizHandler with factory
  - [ ] Test quiz deployment
  - [ ] Save addresses to deployment artifacts
- [ ] **verify-contracts.js** script for Etherscan verification

### Deployment Execution
- [ ] **Deploy contracts**:
```bash
npx hardhat run scripts/deploy-base-sepolia.js --network baseSepolia
```
- [ ] **Verify contracts on Basescan**:
```bash
npx hardhat verify --network baseSepolia <FACTORY_ADDRESS>
npx hardhat verify --network baseSepolia <HANDLER_ADDRESS> <BOT_ADDRESS>
```

### Post-Deployment Validation
- [ ] **Factory contract verified** on Basescan
- [ ] **Handler contract verified** on Basescan
- [ ] **Handler registered** in factory
- [ ] **Test quiz deployment** through factory succeeds
- [ ] **Contract addresses saved** to `.env` or config file
- [ ] **ABI files exported** for integration

**Success Criteria**: ✅ All contracts deployed, verified, and functional on Base Sepolia

---

## 🔗 **Step 3: Collab.Land Account Kit Integration Scripts**

### Account Kit Setup
- [ ] **Account Kit SDK installed**:
```bash
npm install @collabland/account-kit-sdk
```
- [ ] **Environment variables configured**:
  - [ ] `ACCOUNT_KIT_PROJECT_ID`
  - [ ] `ACCOUNT_KIT_API_KEY`
- [ ] **Base Sepolia provider** configured in Account Kit

### Integration Scripts
- [ ] **test-collabland-integration.js** created
  - [ ] Initialize AccountKitProvider for Base Sepolia
  - [ ] Load deployed contract addresses and ABIs
  - [ ] Test factory contract interaction
  - [ ] Test quiz deployment through Collab.Land
  - [ ] Test bot result recording through Collab.Land
  - [ ] Verify transaction hashes and events

### Script Components
- [ ] **Provider initialization**:
```javascript
const provider = new AccountKitProvider({
  chain: 'base-sepolia',
  projectId: process.env.ACCOUNT_KIT_PROJECT_ID
});
```
- [ ] **Factory interaction test**
- [ ] **Quiz deployment test**
- [ ] **Bot authorization test**
- [ ] **Result recording test**
- [ ] **Event monitoring test**

### Validation Tests
- [ ] **Run integration script**:
```bash
node scripts/test-collabland-integration.js
```
- [ ] **Verify quiz creation** through Collab.Land succeeds
- [ ] **Verify bot can record results** through Collab.Land
- [ ] **Check transaction receipts** and gas usage
- [ ] **Verify events emitted** correctly

**Success Criteria**: ✅ Collab.Land Account Kit can deploy and interact with contracts

---

## 🤖 **Step 4: Discord Bot Integration**

### Bot Service Implementation
- [ ] **BaseSepoliaQuizService.js** created
  - [ ] AccountKitProvider integration
  - [ ] Contract address configuration
  - [ ] Quiz creation methods
  - [ ] Result recording methods
  - [ ] Event monitoring setup

### Discord Command Updates
- [ ] **createquiz command** updated for Base Sepolia
  - [ ] Parameter validation
  - [ ] Collab.Land integration
  - [ ] Error handling
  - [ ] Success response with transaction details

- [ ] **Quiz participation flow** implemented
  - [ ] Quiz question generation
  - [ ] Answer validation
  - [ ] Result submission to contract
  - [ ] Payout confirmation

### Bot Integration Components
- [ ] **Quiz creation workflow**:
  - [ ] Discord slash command
  - [ ] Parameter collection
  - [ ] Collab.Land contract deployment
  - [ ] Transaction confirmation
  - [ ] Quiz registration in bot database

- [ ] **Quiz participation workflow**:
  - [ ] User quiz initiation
  - [ ] Question generation and display
  - [ ] Answer collection
  - [ ] Off-chain validation
  - [ ] On-chain result recording
  - [ ] Payout confirmation

- [ ] **Event monitoring**:
  - [ ] QuizCreated event handling
  - [ ] QuizResultRecorded event handling
  - [ ] Discord notifications for payouts
  - [ ] Error event handling

### Testing Scenarios
- [ ] **End-to-end quiz lifecycle**:
  - [ ] Creator uses `/createquiz` command
  - [ ] Quiz deploys successfully on Base Sepolia
  - [ ] Multiple users participate in quiz
  - [ ] All participants receive payouts
  - [ ] Quiz expires and returns unclaimed funds

- [ ] **Error handling scenarios**:
  - [ ] Insufficient funding
  - [ ] Invalid parameters
  - [ ] Network failures
  - [ ] Transaction failures

### Verification Commands
```bash
# Start bot in test mode
npm run start:test

# Run bot integration tests
npm run test:discord-bot-sepolia

# Monitor bot logs
npm run logs:bot
```

**Success Criteria**: ✅ Complete quiz lifecycle works through Discord bot on Base Sepolia

---

## 🚀 **Final Verification Checklist**

### Comprehensive System Test
- [ ] **Complete user journey**:
  - [ ] User creates quiz via Discord command
  - [ ] Quiz deploys to Base Sepolia via Collab.Land
  - [ ] Multiple users participate in quiz
  - [ ] Bot records results and triggers payouts
  - [ ] Users receive ETH rewards on Base Sepolia
  - [ ] Quiz expires and returns unclaimed funds to creator

- [ ] **Security validation**:
  - [ ] Only authorized bot can record results
  - [ ] Users cannot participate twice
  - [ ] Funds are properly secured and distributed
  - [ ] Quiz expiry works correctly

- [ ] **Performance validation**:
  - [ ] Gas costs are reasonable
  - [ ] Transactions confirm quickly on Base Sepolia
  - [ ] Bot responds promptly to Discord commands
  - [ ] Event monitoring is reliable

### Documentation & Cleanup
- [ ] **Update documentation** with Base Sepolia addresses
- [ ] **Create user guide** for quiz creation
- [ ] **Document bot commands** and usage
- [ ] **Save deployment artifacts** and configuration
- [ ] **Create monitoring dashboard** (optional)

**Final Success Criteria**: ✅ System fully operational on Base Sepolia with Discord bot integration

---

## 📁 **Reference Information**

### Key Addresses (To be filled during deployment)
- **Base Sepolia Network**: Chain ID 84532
- **MotherFactory**: `<FACTORY_ADDRESS>`
- **QuizHandler**: `<HANDLER_ADDRESS>`
- **Bot Wallet**: `<BOT_WALLET_ADDRESS>`

### Important Commands
```bash
# Local testing
npx hardhat test

# Base Sepolia deployment
npx hardhat run scripts/deploy-base-sepolia.js --network baseSepolia

# Contract verification
npx hardhat verify --network baseSepolia <ADDRESS> <CONSTRUCTOR_ARGS>

# Collab.Land integration test
node scripts/test-collabland-integration.js

# Discord bot testing
npm run test:discord-bot-sepolia
```

### Environment Variables Required
```bash
PRIVATE_KEY=<deployer_private_key>
BOT_WALLET_ADDRESS=<authorized_bot_address>
BASESCAN_API_KEY=<etherscan_api_key>
ACCOUNT_KIT_PROJECT_ID=<collabland_project_id>
ACCOUNT_KIT_API_KEY=<collabland_api_key>
```

---

**Last Updated**: 2025-06-16  
**Status**: Ready for implementation  
**Next Action**: Begin Step 1 - Contract Implementation
