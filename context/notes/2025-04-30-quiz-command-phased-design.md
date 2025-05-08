# Discord Quiz Bot: Simple Design Overview

## What We're Building

We're creating a Discord bot that lets users generate quizzes from web articles and reward participants with cryptocurrency tokens. Users type `/ask` with a URL, and the bot creates a quiz with token rewards for correct answers.

## How It Works (In Plain Language)

Here's what happens when someone uses the `/ask` command:

1. A user shares a URL and tells the bot what kind of quiz to make
2. Our system extracts the content from the URL
3. The bot generates quiz questions based on that content
4. The user previews the quiz before posting it
5. When approved, the bot creates a smart contract to hold reward tokens
6. The quiz appears in Discord for everyone to participate
7. After the quiz expires, correct answers earn tokens

This approach combines the fun of Discord quizzes with the incentive of token rewards.

## Multi-Agent Architecture

The system will be implemented using a multi-agent architecture with five specialized agents working together:

1. **Orchestrator Agent** - The central coordinator that manages communication between all other agents and orchestrates the overall workflow.

2. **Quiz Agent** - The core agent responsible for creating quizzes based on content and metadata, as well as handling smart contract implementation details for quiz escrow. Communicates with the Orchestrator Agent through a negotiation process to establish metadata requirements and contract specifications.

3. **Discord Formatting Agent** - Takes user input and formats it into metadata for the Quiz Agent. Handles all Discord-specific formatting and UI components.

4. **Solidity Auditor Agent** - Validates smart contracts before deployment to ensure they are free from vulnerabilities and security issues.

5. **Account Kit Agent** - Manages user smart accounts and handles reward distribution to participants. Responsible for processing token transfers, claiming mechanisms, and ensuring proper distribution of rewards according to quiz rules.

### Agent Communication Flow

1. User invokes `/ask` command in Discord
2. Orchestrator Agent receives the command
3. Orchestrator Agent initiates negotiation with Quiz Agent to determine metadata requirements and contract specifications
4. Once metadata format is established, Orchestrator Agent sends user input to Discord Formatting Agent
5. Discord Formatting Agent transforms user input into structured metadata for quiz creation
6. Structured metadata is sent to Quiz Agent for quiz generation and smart contract preparation
7. Quiz Agent creates quiz content and contract code, then returns them to Orchestrator Agent
8. Orchestrator Agent sends quiz to Discord Formatting Agent to create ephemeral message preview
9. Upon approval, Solidity Auditor Agent reviews smart contract code before deployment
10. After deployment, Account Kit Agent manages reward distribution and user interactions

## Command Structure (from original design)

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

## Phase 1: Creating the Quiz

### Multi-Agent Integration for Quiz Creation

#### Orchestrator Agent Implementation
- Create a central orchestration service to manage agent communication
- Implement request routing and response aggregation
- Design state management system to track quiz creation lifecycle
- Handle timeouts and failures in cross-agent communication
- Implement metadata negotiation protocol with Quiz Agent

#### Command Handler Implementation
- Create an `ask.js` command handler in the bot's commands directory
- Connect command handler to Orchestrator Agent
- Implement initial parameter capture and validation
- Create deferReply pattern to handle long-running operations

### Quiz Agent Implementation
- Develop a specialized Quiz Agent service for quiz generation and smart contract implementation
- Implement metadata schema negotiation protocol with Orchestrator Agent, including contract requirements
- Create content extraction methods for various URL types (HTML, PDF, text)
- Design quiz question generation algorithms with configurable parameters
- Ensure all questions include "None of the above" option
- Separate storage of correct answer metadata for security
- Implement smart contract template for QuizEscrowFactory and QuizEscrow contracts
- Design contract deployment process with parameterization
- Create secure reward distribution formulas for contract implementation
- Implement anti-DOS and security features in contract designs
- Implement rate limits and content filters for abuse prevention

### Discord Formatting Agent Implementation
- Create service for handling Discord-specific formatting
- Implement user input transformation into structured metadata
- Design Discord-friendly quiz preview layouts
- Handle Discord formatting constraints and message size limits
- Create user-friendly error messages and validation feedback

### Quiz Preview & Approval Workflow
- Orchestrator Agent coordinates with Discord Formatting Agent to:
  - Create ephemeral message UI with complete quiz preview
  - Add visual indicators for correct answers (only visible to creator)
  - Implement approve/reject/edit buttons
  - Add token spending confirmation UI
- Implement approval timeout with auto-rejection after 10 minutes
- Create feedback loop for quiz edits and modifications

### Solidity Auditor Agent Integration
- Implement initial Solidity Auditor Agent integration
- Design contract validation protocols for Phase 2
- Create security checklist for smart contract audit
- Prepare interfaces for contract deployment preparation

### Account Kit Agent Integration
- Design initial integration points for Account Kit
- Create interfaces for managing user wallets and transactions
- Implement reward distribution planning
- Design claiming mechanisms for quiz participants
- Establish token transfer protocols with proper security

### Token Integration Preparation
- Orchestrator Agent coordinates token validation workflow:
  - Validate token address format and checksum
  - Verify chain ID compatibility and connectivity
  - Design workflow to check creator's token balance and approvals
  - Estimate gas costs for smart contract deployment
  - Work with Discord Formatting Agent to present clear transaction previews
- Prepare contract parameter validation for Phase 2
- Design token approval workflow for seamless user experience

## Phase 2: Launching and Supporting a Live Quiz

### On-Chain Deployment
- Implement smart contract deployment pipeline:
  - Deploy individual QuizEscrow contract via factory
  - Transfer tokens to escrow contract
  - Store contract address and metadata
- Implement robust error handling for failed transactions
- Add transaction status tracking and notifications

### Public Quiz Interface
- Design engaging Discord embed for quiz presentation:
  - Formatted question text and options
  - Clear participation instructions
  - Countdown timer showing expiry
  - Token reward information
- Implement participation button/interface
- Create answer submission mechanism
- Develop real-time participation tracking

### Participant Management
- Create answer recording system:
  - Record user IDs with their answers
  - Prevent duplicate submissions
  - Handle answer changes before expiry
- Add participation statistics tracking  
- Implement anti-spam measures

### Real-Time Updates
- Create periodic status updates in thread:
  - Participation count
  - Time remaining
  - Token pot status
- Implement reminder notifications near expiry
- Add event hooks for significant milestones

## Phase 3: Quiz End and Resolution

### Quiz Expiration Handler
- Implement automatic expiry based on timestamp
- Create expiration event handler
- Generate final participation report
- Lock further submissions at expiry time

### Results Processing
- Reveal correct answers to all participants
- Calculate reward distribution:
  - 75% to correct answers (shared equally)
  - 25% to incorrect answers (shared equally, with cap)
  - Handle edge cases (no correct answers, no incorrect answers)
- Generate detailed results summary
- Post final results to quiz thread

### Reward Distribution
- Implement on-chain settlement process:
  - Mark quiz as resolved
  - Calculate exact token allocations
  - Handle fractional token amounts
  - Process refunds for any remaining balance
- Create claim mechanism for participants
- Implement transaction verification and retries

### Analytics & Retention
- Store quiz history in database:
  - Questions, answers, and participation metrics
  - Token distribution records
  - Performance analytics
- Generate insights for quiz creators
- Implement leaderboards and participant statistics
- Create re-engagement hooks for future quizzes

## Technical Considerations Across All Phases

### Error Handling
- Implement comprehensive error handling:
  - Network failures
  - Blockchain transaction issues
  - Service unavailability
  - Invalid inputs
- Create user-friendly error messages
- Implement automatic retry mechanisms
- Design fallback procedures for critical failures

### Security Measures
- Implement proper authentication for all actions
- Validate all user inputs
- Add rate limiting for command usage
- Implement secure storage of sensitive metadata
- Create audit logs for important actions

### Performance Optimization
- Optimize blockchain interactions to minimize gas costs
- Implement efficient database access patterns
- Use caching for frequently accessed data
- Design for horizontal scalability

### Testing Strategy
- Unit tests for all components
- Integration tests for cross-component functionality 
- End-to-end testing of complete workflows
- Load testing for concurrent quizzes
- Security testing for potential vulnerabilities

This phased approach provides a clear roadmap for implementation while ensuring that each component is thoroughly designed before coding begins.

## Smart Contract Design (from original design)

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

## Security Considerations (from original design)
- Token address validation
- Gas limit considerations for loops
- Potential DOS attack mitigations
- Proper blockchain error handling
- Access control for privileged operations

## Future Extensions (from original design)
- Multi-question support
- Custom reward formulas
- Quiz templates
- Leaderboards and stats
- Quiz history tracking

## Technical Resources (from original design)
- **Token Standard**: ERC-20
- **Default Chain**: Base (8453)
- **Default Token**: 0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1
- **Expiry Calculation**: End of the next day in UTC

## The Team of Specialized Helpers (Multi-Agent System)

Our Discord bot doesn't work alone - it's supported by a team of specialized helpers (what engineers call "agents") that each have their own job. These helpers work together using two communication methods:

1. **A2A Protocol**: A structured way for the helpers to coordinate complex tasks
2. **MCP Protocol**: A direct way for the helpers to quickly share information

This approach is like having both formal team meetings (A2A) and quick hallway conversations (MCP) - using the right communication style for each situation.

### Meet Our Helper Team

The system uses five specialized helpers (agents), each with a specific job:

1. **The Coordinator**: Manages the overall process and keeps everything organized
2. **The Quiz Maker**: Creates quiz questions from web content and designs smart contracts
3. **The Formatter**: Makes everything look good in Discord and handles the user interface
4. **The Security Expert**: Checks smart contracts for problems before they're deployed
5. **The Account Manager**: Handles user wallets and distributes rewards

### How Our Helpers Work Together

#### The Coordinator's Job

The Coordinator (also called the Orchestrator) keeps track of everything happening in the system:

1. **Knows Everyone's Skills**: Maintains a list of what each helper can do
2. **Tracks Progress**: Keeps track of where each quiz is in the creation process
3. **Connects Helpers**: Allows helpers to talk directly when needed
4. **Handles Problems**: Steps in when something goes wrong

#### The Quiz Maker's Jobs

1. **Reads Articles**: Gets the important information from the URL
2. **Creates Questions**: Turns the article content into quiz questions
3. **Makes Contracts**: Creates the smart contracts that hold reward tokens

#### The Formatter's Jobs

1. **Makes Things Pretty**: Creates nice-looking Discord messages
2. **Builds Interfaces**: Creates buttons and other interactive elements
3. **Handles User Actions**: Responds when users click buttons

#### The Security Expert's Jobs

1. **Checks Contracts**: Reviews smart contracts for security issues
2. **Suggests Improvements**: Recommends ways to make contracts better
3. **Estimates Costs**: Calculates gas fees for blockchain transactions

#### The Account Manager's Jobs

1. **Manages Wallets**: Helps users connect their crypto wallets
2. **Processes Rewards**: Handles token distribution after quizzes end
3. **Tracks Balances**: Monitors token balances and transactions

### How Our Helpers Talk to Each Other

Our system uses two main ways for the helpers to communicate:

#### Formal Communication (A2A)

This is like team meetings where the Coordinator keeps track of everything:

1. **Structured Conversations**: Following a specific format so everyone understands
2. **Progress Tracking**: Recording each step of the quiz creation process
3. **Public Record**: Maintaining a history of all communications

#### Direct Communication (MCP)

This is like quick hallway conversations for efficiency:

1. **Direct Messages**: Helpers can talk directly when it's more efficient
2. **Specific Requests**: Asking for exactly what they need
3. **Quick Responses**: Getting answers without waiting for the Coordinator

#### Example Scenarios

1. **Creating Quiz Questions**:
   - The Coordinator tells the Quiz Maker to generate questions from a URL
   - The Quiz Maker reads the article and creates appropriate questions
   - The Quiz Maker sends the questions back to the Coordinator

2. **Checking Smart Contracts**:
   - The Quiz Maker creates a contract and directly asks the Security Expert to check it
   - The Security Expert reviews it and suggests improvements
   - They work together directly until the contract is secure
   - The final version goes back to the Coordinator

## Implementation Plan: Three Phases

### Phase 1: Building the Quiz Creator

In the first phase, we'll create the core quiz generation system:

1. **Discord Command**: Create the `/ask` command that accepts:
   - URL to create a quiz from
   - Quiz prompt explaining what kind of questions to make
   - Optional settings for token type, amount, and expiry time

2. **Content Processing**: Build the system to extract content from URLs

3. **Quiz Generation**: Create the engine that turns content into quiz questions

4. **Preview System**: Build the approval workflow with ephemeral messages that show:
   - The full quiz preview including questions and answers
   - Correct answers highlighted (only visible to quiz creator)
   - Approve/Reject buttons

### Phase 2: Managing Live Quizzes

In the second phase, we'll implement the live quiz experience:

1. **Smart Contracts**: Create secure contracts for quiz rewards that:
   - Hold tokens in escrow during the quiz
   - Distribute 75% of rewards to correct answers
   - Distribute 25% of rewards to incorrect answers (capped)
   - Include security features like re-entrancy protection
   - Default to using token 0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1 on Base (8453)

2. **Quiz UI**: Design an engaging quiz interface in Discord

3. **Participation System**: Create the mechanics for users to submit answers

4. **Expiry System**: Implement the expiration mechanism (end of next day UTC)

### Phase 3: Handling Quiz Results and Rewards

In the final phase, we'll complete the reward distribution system:

1. **Results Processing**: Calculate final quiz results

2. **Reward Distribution**: Implement the token distribution system

3. **Analytics**: Create quiz statistics and reporting tools

4. **User Account Integration**: Connect with user wallets for seamless rewards
