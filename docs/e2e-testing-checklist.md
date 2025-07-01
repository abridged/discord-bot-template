# Discord Bot End-to-End Testing Plan
## Base Sepolia v2 Contract Integration

### 🎯 **Phase 1: Environment Configuration & Validation**

#### 1.1 Bot Environment Setup
**Required Environment Variables:**
```bash
# Blockchain Configuration
USE_REAL_BLOCKCHAIN=true
BLOCKCHAIN_ENABLED=true
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# v2 Contract Addresses
MOTHER_FACTORY_ADDRESS=0xFC94d8b4CB7a73Cd4E6b3dE152df26066f6Ae9E0
QUIZ_HANDLER_ADDRESS=0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903

# Bot Wallet (Authorized for deployments)
DEPLOYMENT_PK=<Discord Bot Private Key>
BOT_WALLET=0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee

# Discord Configuration
DISCORD_TOKEN=<Bot Token>
DISCORD_CLIENT_ID=<Client ID>

# Optional - OpenAI for quiz generation
OPENAI_API_KEY=<API Key>
OPENAI_DEMO_MODE=false
```

#### 1.2 Pre-Flight Checks
- [ ] **RPC Connectivity**: Test Base Sepolia RPC endpoint
- [ ] **Bot Wallet Funding**: Ensure sufficient Base Sepolia ETH (≥0.01 ETH)
- [ ] **Contract Access**: Verify bot can call `motherFactory.deploymentFee()`
- [ ] **Authorization**: Confirm bot is authorized for `deployContract()`
- [ ] **Discord Permissions**: Bot has message/embed permissions in test server

---

### 🧪 **Phase 2: Automated Testing Framework**

#### 2.1 Contract Integration Tests
Create `src/__tests__/e2e/contract-integration.test.js`:

```javascript
describe('Base Sepolia v2 Contract Integration', () => {
  beforeAll(async () => {
    // Initialize services with real blockchain
    process.env.USE_REAL_BLOCKCHAIN = 'true';
  });

  test('Connect to MotherFactory v2', async () => {
    // Test basic contract connectivity
    const deploymentFee = await motherFactory.deploymentFee();
    expect(deploymentFee.gt(0)).toBe(true);
  });

  test('Bot wallet authorization check', async () => {
    // Verify bot can call restricted functions
    const authorizedBot = await motherFactory.authorizedBot();
    expect(authorizedBot.toLowerCase()).toBe(BOT_WALLET.toLowerCase());
  });

  test('Quiz deployment flow', async () => {
    // Test full contract deployment
    const params = { correctReward: 1000, incorrectReward: 100 };
    const result = await blockchainService.submitQuiz(mockQuizData, params);
    expect(result.success).toBe(true);
    expect(result.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});
```

#### 2.2 Discord Integration Tests
Create `src/__tests__/e2e/discord-flows.test.js`:

```javascript
describe('Discord Bot E2E Flows', () => {
  test('Full quiz creation workflow', async () => {
    // Simulate /mother command execution
    const interaction = createMockInteraction('/mother');
    await handleSlashCommand(interaction);
    
    // Verify quiz modal response
    expect(interaction.showModal).toHaveBeenCalled();
    
    // Simulate modal submission
    const modalSubmission = createMockModalSubmission(quizData);
    await handleModalSubmit(modalSubmission);
    
    // Verify blockchain deployment occurred
    expect(blockchainService.submitQuiz).toHaveBeenCalled();
  });

  test('Balance verification integration', async () => {
    // Test Collab.Land Account Kit integration
    const balance = await checkUserBalance(mockUser);
    expect(balance).toBeDefined();
    expect(typeof balance).toBe('object');
  });

  test('Error handling - insufficient funds', async () => {
    // Mock insufficient balance scenario
    const poorUser = { balance: 0 };
    const result = await processQuizCommand(poorUser, quizData);
    
    expect(result.error).toContain('insufficient balance');
  });
});
```

---

### 🎮 **Phase 3: Manual Discord Testing**

#### 3.1 Core User Journey Tests

**Test Scenario 1: Basic Quiz Creation**
1. Execute `/mother` command in Discord
2. Fill quiz modal with valid parameters:
   - Question: "What is 2+2?"
   - Correct: "4" 
   - Incorrect: "5"
   - Rewards: 1000/100 tokens
3. ✅ **Expected**: Quiz deploys successfully, message posted with buttons

**Test Scenario 2: Quiz Participation**
1. User clicks quiz answer button
2. Submit answer (correct/incorrect)
3. ✅ **Expected**: Result recorded on-chain, reward distributed

**Test Scenario 3: Quiz Expiry**
1. Create quiz, wait 24+ hours (or modify contract for testing)
2. ✅ **Expected**: Funds recoverable by creator

#### 3.2 Edge Case Testing

**Network Stress Tests:**
- [ ] High gas price periods (>50 gwei)
- [ ] RPC node downtime/switching
- [ ] Multiple concurrent deployments
- [ ] Large quiz content (Discord limits)

**User Error Scenarios:**
- [ ] Invalid quiz parameters (zero rewards)
- [ ] Missing balance for deployment
- [ ] Expired Discord interaction tokens
- [ ] Duplicate quiz submissions

---

### 🔍 **Phase 4: Monitoring & Observability**

#### 4.1 Logging Framework
Implement comprehensive logging in `src/utils/logger.js`:

```javascript
const logger = {
  contractDeployment: (txHash, contractAddress) => {
    console.log(`✅ Quiz deployed: ${contractAddress} (tx: ${txHash})`);
  },
  
  userAction: (userId, action, details) => {
    console.log(`👤 User ${userId}: ${action}`, details);
  },
  
  blockchainError: (error, context) => {
    console.error(`⛓️ Blockchain error in ${context}:`, error);
  }
};
```

#### 4.2 Health Check Endpoints
Create monitoring dashboard checking:
- [ ] RPC endpoint latency
- [ ] Bot wallet balance
- [ ] Contract interaction success rate
- [ ] Discord API response times

---

### 🚀 **Phase 5: Production Deployment**

#### 5.1 Pre-Production Checklist
- [ ] All automated tests passing
- [ ] Manual test scenarios validated
- [ ] Error handling verified
- [ ] Performance benchmarks met
- [ ] Security review completed

#### 5.2 Deployment Package
- [ ] Environment configuration templates
- [ ] Deployment scripts
- [ ] Monitoring setup
- [ ] Rollback procedures
- [ ] User documentation

#### 5.3 Post-Deployment Validation
- [ ] Live transaction verification on Base Sepolia
- [ ] User acceptance testing in production Discord
- [ ] Performance monitoring active
- [ ] Error alerting configured

---

### 📊 **Success Metrics**

**Technical KPIs:**
- Quiz deployment success rate: >95%
- Average deployment time: <30 seconds
- Discord interaction response time: <3 seconds
- Contract interaction gas efficiency: <$0.10 per deployment

**User Experience KPIs:**
- Quiz completion rate: >80%
- User error rate: <5%
- Support ticket volume: Minimal
- User satisfaction: High (via feedback)

---

### 🔧 **Quick Start Commands**

```bash
# Run contract integration tests
npm run test:e2e:contracts

# Run Discord integration tests  
npm run test:e2e:discord

# Start bot in staging mode
npm run start:staging

# Deploy to production
npm run deploy:production
```

---

**Next Immediate Actions:**
1. ✅ Update `.env` with v2 contract addresses
2. ✅ Fund bot wallet with Base Sepolia ETH
3. ✅ Run Phase 1 validation tests
4. ✅ Implement Phase 2 automated tests
5. ✅ Execute Phase 3 manual testing
