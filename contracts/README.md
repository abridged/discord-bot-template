# Quiz Factory Contracts

This directory contains the smart contracts for the quiz factory system. These contracts allow anyone to create quizzes with token rewards, separating the funds management from the quiz logic.

## Contract Architecture

The system consists of two main contracts:

1. **QuizFactory.sol** - Factory contract that creates and tracks quiz escrow contracts
2. **QuizEscrow.sol** - Escrow contract that handles fund storage and reward distribution

## Manual Deployment

Follow these steps to deploy the QuizFactory contract to any EVM-compatible network:

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Hardhat (`npm install --save-dev hardhat`)
- A wallet with funds for the target network

### Setup

1. Configure your environment variables by creating a `.env` file in the project root:

```
# Deployment wallet private key (keep this secret!)
PRIVATE_KEY=your_private_key_here

# RPC endpoints
BASE_GOERLI_RPC_URL=https://goerli.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org

# Optional - for contract verification
BASESCAN_API_KEY=your_basescan_api_key
```

2. Compile the contracts:

```bash
npx hardhat compile
```

### Deployment

Deploy to a testnet (Base Goerli):

```bash
npx hardhat run contracts/scripts/deploy.js --network baseGoerli
```

Deploy to mainnet (Base):

```bash
npx hardhat run contracts/scripts/deploy.js --network base
```

The script will output the deployed contract address. Save this address as you'll need it to interact with the factory.

### Verification

The deployment script will attempt to verify the contract on the blockchain explorer automatically. If verification fails, you can manually verify the contract:

```bash
npx hardhat verify --network baseGoerli <DEPLOYED_CONTRACT_ADDRESS>
```

## Integration with Discord Bot

After deployment, update the contract address in your application:

1. Update the `.env` file with the QuizFactory address:

```
QUIZ_FACTORY_ADDRESS=0x...your_contract_address_here
```

2. The JavaScript interface for interacting with the contracts is located in `src/contracts/quizEscrow.js`

## Testing

Run the test suite:

```bash
npx hardhat test
```

## Quiz Contract Usage

### Creating a Quiz Escrow

1. The token owner must first approve the QuizFactory contract to spend tokens:
   ```solidity
   // Token owner approves the factory to spend tokens
   tokenContract.approve(quizFactoryAddress, rewardAmount);
   ```

2. Call the `createQuizEscrow` function on the QuizFactory:
   ```solidity
   // Creates a new quiz escrow with a 100 token reward that expires in 24 hours
   quizFactory.createQuizEscrow(
     "unique_quiz_id",
     tokenAddress,
     100 * 10**18, // 100 tokens with 18 decimals
     block.timestamp + 24 hours
   );
   ```

### Registering Participants

The quiz creator registers participants who have taken the quiz (managed off-chain):
```solidity
// Register a single participant
quizEscrow.registerParticipant(participantAddress);

// Register multiple participants in one transaction
quizEscrow.batchRegisterParticipants([address1, address2, address3]);
```

### Distributing Rewards

After the quiz expires, the creator distributes rewards based on off-chain quiz results:
```solidity
// Distribute rewards to participants
quizEscrow.distributeRewards(
  [address1, address2, address3], // Recipient addresses
  [50, 30, 20]                    // Reward amounts
);
```

### Claiming Rewards

Participants can claim their rewards after distribution:
```solidity
quizEscrow.claimReward();
```
