# Quiz Command Design Summary (April 26, 2025)

## Overview

This document summarizes the design and implementation plan for the `/ask` Discord slash command and associated smart contracts for creating quiz-based content from URLs.

## Discord Slash Command: `/ask`

### Basic Command Structure
- **Command name**: `/ask`
- **Purpose**: Generate quizzes based on content from a URL
- **Required parameters**:
  - `prompt`: Natural language instructions for quiz generation
  - `url`: Source content URL to base quiz on
- **Optional parameters**:
  - `token`: Custom token address (default: 0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1)
  - `chain`: Custom chain ID (default: 8453)
  - `amount`: Custom token amount (default: 10000)
  - `expiry`: Custom expiry time (default: end of next day UTC)

### Workflow
1. User invokes `/ask` command with parameters
2. Bot sends input to polling/quiz agent service
3. Quiz is generated and returned to bot
4. Bot sends **ephemeral message** to command initiator with:
   - Complete quiz preview
   - Correct/incorrect answer indicators
   - Approval UI
5. If approved, bot creates on-chain quiz and posts to Discord channel
6. Quiz remains active until expiry time

### Quiz Format
- Each question must include "None of the above" as an option
- Correct answer recipients share 75% of total pot
- Incorrect answer recipients share 25% of total pot
- Incorrect rewards capped to no more than correct rewards
- Any leftover funds refunded to quiz creator

### Metadata Tracking
- Discord user ID that created the quiz
- Agent ID that generated the quiz content
- Token address, chain ID, and amount
- Expiry timestamp (end of next day UTC)
- Source URL and prompt text

## Smart Contract Design

### Contract Architecture
- **QuizEscrowFactory**: Deploys individual quiz contracts
- **QuizEscrow**: Individual contract per quiz that:
  - Escrows funds
  - Records answers on-chain
  - Distributes rewards after expiry

### Key Contract Features
- **Security Features**:
  - Re-entrancy protection
  - SafeERC20 implementation
  - Precision loss prevention
  - Input validation
  - Access control system
  - Anti-DOS protections
  - Emergency stop with reason logging

- **Anti-DOS Protections**:
  - Participant limit (configurable)
  - Duplicate answer prevention
  - Bounded loops
  - Individual claim processing
  - Division by zero protection
  - Pausable contract

- **Reward Distribution**:
  - 75% of pot to correct answers (shared equally)
  - 25% of pot to incorrect answers (shared equally)
  - Cap on incorrect rewards (≤ correct rewards)
  - Leftover funds returned to quiz creator

### Fund Flow
1. Quiz creator approves tokens for contract
2. On quiz approval, tokens are escrowed in quiz contract
3. During active period, users submit answers
4. After expiry, bot resolves quiz
5. Users claim individual rewards
6. Any remainder is returned to creator

## Implementation Phases

### Phase 1: Discord Command Structure
- Implement slash command registration
- Set up parameter validation
- Create approval workflow with ephemeral messages

### Phase 2: Quiz Generation
- Implement polling agent integration
- Ensure "None of the above" option in all questions
- Handle correct/incorrect answer metadata

### Phase 3: Smart Contract Development
- Implement and test QuizEscrowFactory
- Implement and test QuizEscrow contract
- Deploy to testnet for validation

### Phase 4: Integration
- Connect Discord bot to deployed contracts
- Implement quiz posting with embedded metadata
- Create user-friendly UI for quiz participation

## Security Considerations
- Token address validation
- Gas limit considerations for loops
- Potential DOS attack mitigations
- Proper blockchain error handling
- Access control for privileged operations

## Future Extensions
- Multi-question support
- Custom reward formulas
- Quiz templates
- Leaderboards and stats
- Quiz history tracking

## Technical Resources
- **Token Standard**: ERC-20
- **Default Chain**: Base (8453)
- **Default Token**: 0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1
- **Expiry Calculation**: End of the next day in UTC
