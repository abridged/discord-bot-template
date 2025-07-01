# Account Kit Integration: Step-by-Step Implementation Plan
**Date: May 19, 2025**

This document outlines the phased implementation plan for integrating Collab.Land Account Kit with our Discord bot for quiz funding and reward distribution.

## Phase 1: User Smart Account Discovery (Days 1-2)

### Step 1.1: Basic Integration Testing
- Verify the installed SDK works properly with a simple test command
- Create `/wallet-test` command that attempts to connect to Account Kit and returns success/failure
- Output should confirm API connection is working

### Step 1.2: User Wallet Lookup
- Create `/my-wallet` command that looks up the caller's wallet address using Account Kit
- Display the retrieved wallet address to the user
- Handle cases where user doesn't have a wallet

### Step 1.3: Balance Checking
- Enhance `/my-wallet` to include token balance for a specified token
- Add parameters: `token:[address]` and `chain:[id]` (defaulting to the quiz token and chain)
- Show user's wallet address and current balance of specified token

## Phase 2: Quiz Creation Pre-validation (Days 3-4)

### Step 2.1: Extend Quiz Command
- Update `/ask` command to accept additional parameters for token funding
- Add validation to check if user has Account Kit wallet before proceeding
- Success: Show confirmation that wallet was found
- Failure: Show instructions on how to get a Collab.Land wallet

### Step 2.2: Implement Balance Pre-check
- Add balance check when user initiates `/ask` command
- If balance is insufficient, show error message with required amount
- Only generate quiz preview if user has sufficient balance
- Add debugging command to simulate different balance scenarios

### Step 2.3: Quiz Preview Enhancement
- Update quiz preview UI to include funding information
- Show token amount, token address, and chain
- Make it clear approval will transfer funds from their wallet

## Phase 3: Escrow Account & Transaction (Days 5-7)

### Step 3.1: Quiz Escrow Account Creation
- Create quiz-specific escrow account using Account Kit
- Update database schema to store escrow account address with quiz
- Add debugging command to verify escrow account creation

### Step 3.2: Test Transaction Flow
- Create `/test-transfer` command to validate transfer functionality
- Transfer small amount between test accounts
- Verify transaction success and error handling

### Step 3.3: Connect Approval to Funding
- Integrate fund transfer into quiz approval button handler
- Show transaction progress indicators
- Provide clear success/failure messages
- Store transaction hash in database

## Phase 4: Quiz Lifecycle Integration (Days 8-10)

### Step 4.1: Quiz Status Tracking
- Implement tracking of quiz funding status
- Add states: unfunded, funding in progress, funded, distribution in progress, completed
- Show status in quiz management UI

### Step 4.2: Transaction Monitoring
- Add background job to monitor transaction status
- Update quiz status based on blockchain confirmation
- Handle transaction failures gracefully

### Step 4.3: Basic Reward Distribution
- Implement simple distribution logic to test fund disbursement
- Create test command to trigger distribution for a specific quiz
- Verify funds are correctly sent to test participants

## Phase 5: Complete Quiz Lifecycle (Days 11-14)

### Step 5.1: Full Integration Testing
- Connect quiz expiry to automatic reward distribution
- Test end-to-end flow from creation to distribution
- Verify correct reward calculation based on answers

### Step 5.2: Error Handling & Recovery
- Add comprehensive error handling for all failure scenarios
- Implement recovery mechanisms for failed transactions
- Create admin commands to troubleshoot issues

### Step 5.3: Documentation & Monitoring
- Create user documentation for the funding flow
- Implement logging for all Account Kit interactions
- Add monitoring for transaction success rates

## Verification Process

For each implementation step, we will:

1. **Create a verification command/function** that tests just that functionality
2. **Document expected outcomes** for both success and failure cases
3. **Include screenshots** of Discord interactions showing the feature working
4. **Log all API interactions** for debugging purposes
5. **Create test accounts/wallets** specifically for testing

This phased approach ensures we can build and verify each component incrementally before moving to the next step.
