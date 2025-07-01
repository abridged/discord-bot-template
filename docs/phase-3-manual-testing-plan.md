# Phase 3: Manual Discord Testing - Step-by-Step Plan

## Overview
This plan ensures the Discord bot works end-to-end with Base Sepolia v2 contracts through systematic manual testing with verification checkpoints.

---

## 🔧 **Stage 1: Environment & Configuration Verification**

### **Step 1.1: Verify Bot Environment Configuration**
**Goal**: Ensure `.env` has correct v2 contract addresses and Base Sepolia settings

**Actions**:
1. Check `.env` file contains:
   - `MOTHER_FACTORY_ADDRESS=0xFC94d8b4CB7a73Cd4E6b3dE152df26066f6Ae9E0`
   - `QUIZ_HANDLER_ADDRESS=0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903`
   - `BASE_SEPOLIA_RPC_URL=<your-RPC-URL>`
   - `DISCORD_BOT_PRIVATE_KEY=<your-bot-wallet-key>`
   - `USE_REAL_BLOCKCHAIN=true`
   - `DISCORD_TOKEN=<your-discord-token>`
   - `DISCORD_CLIENT_ID=<your-discord-client-id>`

**Verification Checkpoint**:
- [ ] All required environment variables present
- [ ] Contract addresses match Base Sepolia v2 deployment
- [ ] RPC URL responds to test calls
- [ ] Bot wallet has sufficient ETH for gas (~0.01 ETH minimum)

**Expected Result**: Environment configured for Base Sepolia v2 integration

---

### **Step 1.2: Verify Contract Connectivity**
**Goal**: Confirm bot can connect to v2 contracts on Base Sepolia

**Actions**:
1. Run contract connectivity test:
   ```bash
   npm test -- --testPathPattern=e2e/contract-integration.test.js
   ```

**Verification Checkpoint**:
- [ ] All 12 contract integration tests pass
- [ ] MotherFactory v2 accessible and authorized bot verified
- [ ] QuizHandler v2 accessible with correct configuration
- [ ] Bot wallet balance sufficient for operations

**Expected Result**: Bot successfully connects to Base Sepolia v2 contracts

---

### **Step 1.3: Start Bot in Development Mode**
**Goal**: Launch bot with real blockchain enabled but in controlled environment

**Actions**:
1. Start bot process:
   ```bash
   npm start
   ```
2. Monitor startup logs for errors
3. Confirm bot shows online status

**Verification Checkpoint**:
- [ ] Bot starts without errors
- [ ] "Bot is ready" message appears in console
- [ ] No blockchain connection errors in logs
- [ ] Bot appears online in Discord (if already in server)

**Expected Result**: Bot running successfully with Base Sepolia connection

---

## 🤖 **Stage 2: Discord Server Setup & Permissions**

### **Step 2.1: Create/Access Staging Discord Server**
**Goal**: Set up controlled environment for testing

**Actions**:
1. Create new Discord server OR use existing test server
2. Ensure you have admin permissions
3. Create dedicated testing channels:
   - `#bot-testing` (for command testing)
   - `#quiz-results` (for result monitoring)

**Verification Checkpoint**:
- [ ] Staging Discord server accessible
- [ ] Admin permissions confirmed
- [ ] Testing channels created

**Expected Result**: Staging environment ready for bot testing

---

### **Step 2.2: Invite Bot to Staging Server**
**Goal**: Add bot with proper permissions

**Actions**:
1. Generate bot invite URL with permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History
   - View Channels
2. Invite bot to staging server
3. Assign bot to testing channels

**Verification Checkpoint**:
- [ ] Bot successfully joined server
- [ ] Bot has required permissions
- [ ] Bot visible in member list
- [ ] Bot can access testing channels

**Expected Result**: Bot properly configured in staging Discord server

---

### **Step 2.3: Test Basic Bot Responsiveness**
**Goal**: Verify bot receives and responds to commands

**Actions**:
1. In `#bot-testing` channel, type: `/ping` (if available)
2. Try `/help` command (if available)  
3. Check bot responds within 5 seconds

**Verification Checkpoint**:
- [ ] Bot responds to basic commands
- [ ] Response time < 5 seconds
- [ ] No error messages in bot console
- [ ] Commands appear in Discord slash command menu

**Expected Result**: Bot basic functionality confirmed

---

## 🎯 **Stage 3: Quiz Creation Flow Testing**

### **Step 3.1: Test /mother Command Invocation**
**Goal**: Verify `/mother` command launches quiz creation flow

**Actions**:
1. In `#bot-testing`, type: `/mother`
2. Select "Create a quiz" option
3. Observe modal appearance

**Verification Checkpoint**:
- [ ] `/mother` command appears in slash command menu
- [ ] Command executes without errors
- [ ] Quiz creation modal appears within 3 seconds
- [ ] Modal contains all required fields:
   - Question text
   - Multiple choice options
   - Correct answer selection
   - Explanation text
   - Reward amounts

**Expected Result**: Quiz creation modal successfully displayed

---

### **Step 3.2: Test User Balance Verification**
**Goal**: Confirm bot checks real user balance via Collab.Land Account Kit

**Actions**:
1. Complete quiz creation modal with valid data
2. Submit modal
3. Monitor bot response for balance check

**Verification Checkpoint**:
- [ ] Bot initiates balance check process
- [ ] "Checking your account balance..." message appears
- [ ] Balance check completes within 10 seconds
- [ ] Real balance amount displayed (not mock data)
- [ ] User notified if insufficient balance OR proceeds to blockchain

**Expected Result**: Real user balance verified successfully

---

### **Step 3.3: Test Blockchain Quiz Submission**
**Goal**: Verify quiz submission to Base Sepolia via MotherFactory v2

**Actions**:
1. If balance sufficient, observe blockchain submission process
2. Monitor console logs for transaction details
3. Wait for transaction confirmation

**Verification Checkpoint**:
- [ ] "Submitting quiz to blockchain..." message appears
- [ ] Transaction hash provided to user
- [ ] Transaction confirms on Base Sepolia within 30 seconds
- [ ] New QuizEscrow contract address returned
- [ ] Quiz saved to bot database with contract address
- [ ] Success message displayed to user

**Expected Result**: Quiz successfully deployed to Base Sepolia

---

### **Step 3.4: Verify Contract Deployment**
**Goal**: Confirm QuizEscrow contract was actually deployed

**Actions**:
1. Copy contract address from bot response
2. Check contract on Base Sepolia explorer (e.g., BaseScan)
3. Verify contract details match quiz parameters

**Verification Checkpoint**:
- [ ] QuizEscrow contract exists at provided address
- [ ] Contract shows recent deployment transaction
- [ ] Contract authorized bot matches expected address
- [ ] Contract contains correct reward amounts
- [ ] MotherFactory shows new quiz in deployment list

**Expected Result**: QuizEscrow contract verified on-chain

---

## 👥 **Stage 4: Quiz Participation Flow Testing**

### **Step 4.1: Test Quiz Discovery & Display**
**Goal**: Verify users can find and view active quizzes

**Actions**:
1. Use different Discord account or ask test user to participate
2. Run quiz discovery command (if available)
3. Verify quiz information displayed correctly

**Verification Checkpoint**:
- [ ] Active quizzes are discoverable
- [ ] Quiz details display correctly (question, options, rewards)
- [ ] Contract address and status shown
- [ ] Participation buttons/commands available

**Expected Result**: Quiz properly displayed for participation

---

### **Step 4.2: Test Quiz Answer Submission**
**Goal**: Verify participants can submit answers

**Actions**:
1. Test user submits answer to quiz
2. Monitor submission process
3. Verify answer recorded

**Verification Checkpoint**:
- [ ] Answer submission interface works
- [ ] User balance checked before submission
- [ ] Submission transaction sent to QuizEscrow
- [ ] Transaction confirms on Base Sepolia
- [ ] User notified of submission success
- [ ] Answer recorded in bot database

**Expected Result**: Quiz answer successfully submitted to blockchain

---

### **Step 4.3: Test Quiz Resolution & Rewards**
**Goal**: Verify quiz completion and reward distribution

**Actions**:
1. Wait for quiz resolution period (or trigger manual resolution)
2. Observe reward distribution process
3. Check participant reward claims

**Verification Checkpoint**:
- [ ] Quiz resolves automatically or manually
- [ ] Correct answers identified
- [ ] Rewards distributed according to quiz parameters
- [ ] Winners notified via Discord
- [ ] Reward transactions confirmed on Base Sepolia
- [ ] Balances updated correctly

**Expected Result**: Quiz rewards distributed successfully

---

## 🔍 **Stage 5: Error Handling & Edge Cases**

### **Step 5.1: Test Insufficient Balance Scenario**
**Goal**: Verify graceful handling of insufficient user balance

**Actions**:
1. Use test account with low/zero balance
2. Attempt quiz creation or participation
3. Observe error handling

**Verification Checkpoint**:
- [ ] Insufficient balance detected correctly
- [ ] User receives clear error message
- [ ] No blockchain transactions attempted
- [ ] Bot remains responsive after error
- [ ] User guided on how to add funds

**Expected Result**: Insufficient balance handled gracefully

---

### **Step 5.2: Test Network/Blockchain Errors**
**Goal**: Verify handling of blockchain connectivity issues

**Actions**:
1. Temporarily disrupt network (if possible) OR wait for natural network issue
2. Attempt quiz operations during disruption
3. Observe error recovery

**Verification Checkpoint**:
- [ ] Network errors detected and reported
- [ ] User receives informative error message
- [ ] Bot retries transactions appropriately
- [ ] Operations resume when network recovers
- [ ] No data loss during network issues

**Expected Result**: Network errors handled with proper user feedback

---

### **Step 5.3: Test Invalid Quiz Data**
**Goal**: Verify validation of quiz creation parameters

**Actions**:
1. Submit quiz with invalid data:
   - Empty question
   - Insufficient options
   - Invalid reward amounts
   - Missing explanation
2. Observe validation responses

**Verification Checkpoint**:
- [ ] Invalid data detected before blockchain submission
- [ ] Clear validation error messages provided
- [ ] User can correct and resubmit
- [ ] No invalid quizzes created on blockchain
- [ ] Bot remains stable after validation errors

**Expected Result**: Quiz validation prevents invalid submissions

---

## 📊 **Stage 6: Performance & User Experience**

### **Step 6.1: Test Response Times**
**Goal**: Verify acceptable performance under normal conditions

**Actions**:
1. Measure time for each major operation:
   - Command response time
   - Modal loading time
   - Balance check duration
   - Blockchain submission time
2. Test with multiple concurrent users if possible

**Verification Checkpoint**:
- [ ] Slash commands respond < 3 seconds
- [ ] Modals load < 2 seconds  
- [ ] Balance checks complete < 10 seconds
- [ ] Blockchain submissions < 60 seconds
- [ ] Bot remains responsive with multiple users

**Expected Result**: Performance meets user experience expectations

---

### **Step 6.2: Test User Experience Flow**
**Goal**: Evaluate overall user journey and identify friction points

**Actions**:
1. Complete full quiz creation flow as new user
2. Complete full quiz participation flow as new user
3. Document any confusion or difficulty points

**Verification Checkpoint**:
- [ ] Flow intuitive for new users
- [ ] Error messages clear and actionable
- [ ] Success states properly communicated
- [ ] Users can complete tasks without assistance
- [ ] No dead ends or stuck states

**Expected Result**: Smooth user experience with minimal friction

---

## 📝 **Stage 7: Documentation & Issue Resolution**

### **Step 7.1: Document All Issues Found**
**Goal**: Track problems for future resolution

**Actions**:
1. Create issue log with:
   - Issue description
   - Steps to reproduce
   - Expected vs actual behavior
   - Severity level
   - Screenshots/logs if applicable

**Verification Checkpoint**:
- [ ] All issues documented thoroughly
- [ ] Issues categorized by severity
- [ ] Reproduction steps clear
- [ ] Impact on user experience assessed

**Expected Result**: Complete issue tracking for resolution

---

### **Step 7.2: Verify Critical Path Success**
**Goal**: Confirm core functionality works end-to-end

**Actions**:
1. Complete one full successful quiz creation → participation → resolution cycle
2. Verify all blockchain transactions completed
3. Confirm all database records accurate

**Verification Checkpoint**:
- [ ] Quiz created successfully on Base Sepolia
- [ ] Users able to participate and submit answers
- [ ] Rewards distributed correctly
- [ ] All transactions confirmed on-chain
- [ ] Bot database in sync with blockchain state

**Expected Result**: Core functionality working end-to-end

---

## 🎯 **Success Criteria for Phase 3 Completion**

### **Must Have** (Critical for production):
- [ ] Bot connects to Base Sepolia v2 contracts successfully
- [ ] Quiz creation flow works end-to-end
- [ ] Quiz participation flow works end-to-end  
- [ ] Reward distribution functions correctly
- [ ] Error handling prevents user frustration
- [ ] No data loss or corruption

### **Should Have** (Important for UX):
- [ ] Response times meet expectations
- [ ] User interface intuitive and clear
- [ ] Error messages helpful and actionable
- [ ] Balance checking works reliably

### **Nice to Have** (Quality of life):
- [ ] Advanced features like quiz editing
- [ ] Enhanced user notifications
- [ ] Detailed transaction tracking
- [ ] Admin monitoring capabilities

---

## 📋 **Next Steps After Phase 3**

Based on Phase 3 results:

**If All Tests Pass**:
- Proceed to production deployment preparation
- Create production environment configuration
- Set up monitoring and alerting

**If Issues Found**:
- Prioritize critical issues for immediate fix
- Update code and retest affected flows
- Document any workarounds needed

**If Major Problems**:
- Consider returning to orchestration refactor
- Evaluate alternative implementation approaches
- Reassess timeline and scope

This plan ensures thorough validation of the Discord bot's integration with Base Sepolia v2 contracts through systematic manual testing with clear verification checkpoints at each stage.
