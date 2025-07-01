# MotherFactory v3 User Direct Deploy - Verification Plan

## Overview
Comprehensive step-by-step verification plan for MotherFactory v3 with user direct deployment capability.

**Goal:** Verify that users can deploy QuizEscrow contracts directly via Account Kit, eliminating bot deployment intermediary.

## Current Status
✅ MotherFactory v3 deployed: `0x85ef58b83366381122d341Dbc9B6689236060aa0`  
✅ QuizHandler v3 deployed: `0xb206c33FE922f5914534970e2c7625A343804CC3`  
✅ `.env` updated with v3 contract addresses (manual)  

## Verification Phases

### Phase 1: Environment & Contract Connectivity ⚙️

#### Step 1.1: Verify Environment Configuration
- [ ] Confirm `.env` has correct v3 contract addresses
- [ ] Verify `USE_REAL_BLOCKCHAIN=true` for testing
- [ ] Check bot wallet and RPC URL configuration
- [ ] Run environment diagnostic script

**Expected:** Bot loads v3 contract addresses successfully

#### Step 1.2: Contract Connectivity Test
- [ ] Create connectivity test script for v3 contracts
- [ ] Verify MotherFactory v3 connection from bot
- [ ] Verify QuizHandler v3 connection from bot
- [ ] Test contract method calls (read-only)

**Expected:** All v3 contract connections succeed, no `onlyAuthorizedBot` errors

#### Step 1.3: Account Kit Integration Test
- [ ] Test user balance checking with Account Kit
- [ ] Verify user wallet address retrieval
- [ ] Test Account Kit transaction preparation (no execution)

**Expected:** Account Kit integration unchanged and functional

---

### Phase 2: QuizService Architecture Update 🔄

#### Step 2.1: Update QuizService for User Deployment
- [ ] Modify `QuizService.deployQuizEscrow()` to use user Account Kit
- [ ] Remove bot wallet signer dependency
- [ ] Update `executeUserContractFunction` call for MotherFactory v3
- [ ] Handle user gas payment and transaction signing

**Key Change:** Switch from bot wallet → user Account Kit for escrow deployment

#### Step 2.2: Update RealBlockchainService
- [ ] Modify `submitQuiz()` to use user deployment flow
- [ ] Remove bot wallet validation for deployment
- [ ] Keep user wallet validation for funding
- [ ] Update error handling for user deployment failures

**Expected:** Clean user deployment flow without bot wallet requirements

#### Step 2.3: Update Service Integration
- [ ] Verify `quizService.contractsAvailable` flag logic
- [ ] Test contract initialization with v3 addresses
- [ ] Ensure QuizService connects to v3 contracts properly

**Expected:** Service initialization works with v3 contracts

---

### Phase 3: Unit Test Updates 🧪

#### Step 3.1: Update Contract Tests
- [ ] Update MotherFactory tests to remove `onlyAuthorizedBot` restriction
- [ ] Test that any address can call `deployContract()`
- [ ] Verify QuizHandler v3 still authorizes bot for result recording
- [ ] Test end-to-end contract deployment with user accounts

**Expected:** All contract tests pass with v3 logic

#### Step 3.2: Update Service Tests
- [ ] Update QuizService tests for user deployment flow
- [ ] Mock Account Kit user deployment calls
- [ ] Test error scenarios (insufficient balance, failed deployment)
- [ ] Verify database logging with user-deployed contracts

**Expected:** All service tests pass with user deployment logic

---

### Phase 4: Integration Testing 🔗

#### Step 4.1: Local Integration Test
- [ ] Create integration test script for v3 user deployment
- [ ] Test full flow: balance check → user deploy → fund → record
- [ ] Verify `transactionHash` and `escrowAddress` populated
- [ ] Test with different user wallet scenarios

**Expected:** Complete user deployment flow works end-to-end

#### Step 4.2: Base Sepolia Integration Test
- [ ] Test on real Base Sepolia with funded user Account Kit
- [ ] Verify actual QuizEscrow deployment by user
- [ ] Check contract deployment gas costs for users
- [ ] Verify bot can still record results

**Expected:** Real blockchain user deployment succeeds

---

### Phase 5: Discord Bot Testing 🤖

#### Step 5.1: Update Discord Handlers
- [ ] Verify `/mother` command works with v3 contracts
- [ ] Test `motherQuizHandler` with user deployment flow
- [ ] Update success/error messages for user deployment
- [ ] Test with `USE_REAL_BLOCKCHAIN=true` and `false`

**Expected:** Discord commands work seamlessly with v3

#### Step 5.2: End-to-End Discord Flow
- [ ] Test `/mother` command on staging Discord server
- [ ] Verify balance checking via Account Kit
- [ ] Test user quiz creation and escrow deployment
- [ ] Verify database records user-deployed contracts
- [ ] Test quiz completion and result recording

**Expected:** Full Discord-to-blockchain flow works with user deployment

---

### Phase 6: Performance & Error Testing ⚡

#### Step 6.1: Error Scenarios
- [ ] Test insufficient user balance for deployment
- [ ] Test Account Kit transaction rejection
- [ ] Test MotherFactory deployment failures
- [ ] Test network connectivity issues
- [ ] Verify proper error messages to users

**Expected:** Graceful error handling and user feedback

#### Step 6.2: Performance Testing
- [ ] Measure gas costs for user QuizEscrow deployment
- [ ] Test deployment speed compared to v2 bot deployment
- [ ] Verify transaction confirmation times
- [ ] Test with multiple concurrent user deployments

**Expected:** Performance meets or exceeds v2 bot deployment

---

## Success Criteria

### ✅ **Phase 1 Success:**
- Bot connects to v3 contracts
- Account Kit integration unchanged
- Environment configuration verified

### ✅ **Phase 2 Success:**
- QuizService uses user Account Kit for deployment
- RealBlockchainService updated for user flow
- No bot wallet dependency for deployment

### ✅ **Phase 3 Success:**
- All contract and service tests pass
- User deployment logic fully tested
- Test coverage maintained

### ✅ **Phase 4 Success:**
- Local and Base Sepolia integration tests pass
- User deployment creates real QuizEscrow contracts
- Bot still records results properly

### ✅ **Phase 5 Success:**
- Discord bot works with v3 user deployment
- `/mother` command creates user-deployed quizzes
- Database logging works correctly

### ✅ **Phase 6 Success:**
- Error scenarios handled gracefully
- Performance acceptable for production
- User experience improved

## Risk Mitigation

### High Priority Risks:
1. **Account Kit API Changes:** Test thoroughly with real user accounts
2. **Gas Cost Impact:** Monitor user deployment costs vs v2 bot deployment
3. **Transaction Failures:** Robust error handling for failed user deployments
4. **Database Consistency:** Ensure quiz records match actual deployed contracts

### Rollback Plan:
- Keep v2 deployment files as backup
- Environment flag to switch between v2/v3 if needed
- Database migration plan for any data structure changes

## Next Immediate Steps:
1. **Phase 1.1:** Verify environment configuration
2. **Phase 1.2:** Test v3 contract connectivity
3. **Phase 2.1:** Update QuizService for user deployment

**Ready to proceed with Phase 1.1? 🚀**
