# Intuition Integration with Factory Contract

*Date: June 9, 2025*

This document outlines a strategy for integrating the Intuition knowledge graph with our blockchain factory contract system for poll and quiz management.

## Integration Objectives

1. **Metadata Enhancement**: Augment on-chain quiz/poll data with rich metadata from Intuition
2. **Identity Linking**: Connect Discord user identities with blockchain identities and Intuition atoms
3. **Future Agent Discovery**: Prepare for future agent discovery capabilities

## Integration Architecture

### Blockchain Side (On-Chain Components)

1. **Metadata Reference Storage**

```solidity
contract PollQuizFactory {
    // Intuition reference fields in contract structures
    struct QuizData {
        // Regular quiz fields
        bytes32 quizId;
        address creator;
        uint256 rewardAmount;
        
        // Intuition reference
        bytes32 intuitionAtomId;  // Reference to corresponding entity in Intuition
    }
    
    // Storage for quizzes with Intuition references
    mapping(bytes32 => QuizData) public quizzes;
    
    // Event with Intuition reference
    event QuizCreated(
        bytes32 indexed quizId,
        address indexed creator,
        address escrowAddress,
        bytes32 intuitionAtomId  // Including the reference in events
    );
    
    // Create quiz with Intuition reference
    function createQuiz(
        string calldata title,
        uint256 rewardAmount,
        bytes32 intuitionAtomId  // Optional reference to Intuition
    ) external returns (address) {
        // Quiz deployment logic...
        
        // Store Intuition reference if provided
        if (intuitionAtomId != bytes32(0)) {
            quizzes[quizId].intuitionAtomId = intuitionAtomId;
        }
        
        // Emit event with Intuition reference
        emit QuizCreated(quizId, msg.sender, quizAddress, intuitionAtomId);
        
        return quizAddress;
    }
}
```

2. **Factory Contract Identity Linking**

```solidity
// Optional extension for identity verification
function verifyIntuitionIdentity(
    bytes32 intuitionAtomId,
    bytes calldata signature
) external view returns (bool) {
    // Verification logic to confirm the link between
    // blockchain address and Intuition atom ID
    
    // This can use EIP-712 signatures or similar mechanisms
}
```

### Bridge Layer (Off-Chain Components)

1. **Event Indexing Service**

Create an indexing service that:
- Watches for events from the factory contract
- Extracts Intuition references from events
- Updates or creates corresponding entities in Intuition

2. **Metadata Enrichment Flow**

```javascript
// Example flow in the bridge service
async function enrichQuizMetadata(quizId, escrowAddress) {
  // Get on-chain data
  const quizData = await factoryContract.quizzes(quizId);
  
  // If Intuition atom exists, fetch additional metadata
  if (quizData.intuitionAtomId !== '0x0000...') {
    const enrichedData = await intuitionClient.get_account_info({
      identifier: quizData.intuitionAtomId
    });
    
    // Store enriched data in application database
    await db.quizzes.update({
      quizId: quizId,
      enrichedMetadata: enrichedData
    });
  }
}
```

## Implementation Strategy

### Phase 1: Reference Integration

1. **Factory Contract Updates**:
   - Add Intuition atom ID fields to relevant structures
   - Include atom IDs in emitted events
   - No functional dependency on Intuition (optional fields)

2. **Discord Bot Updates**:
   - Add utility functions to look up Intuition references
   - Create optional metadata enrichment pipeline

### Phase 2: Identity Verification

1. **Factory Contract Extensions**:
   - Add identity verification functions
   - Support signature verification for Intuition identity claims

2. **UI Flow Updates**:
   - Allow users to link their Discord, wallet, and Intuition identities
   - Use verified identities in poll/quiz participation

### Phase 3: Future Agent Discovery Integration

1. **Registry Contract**:
   - Create a registry contract for specialized agents
   - Include Intuition references for each agent

2. **Discovery Interface**:
   - Build query interfaces for finding specialized agents
   - Enable dynamic agent selection based on capabilities

## Security Considerations

1. **Reference Integrity**:
   - Intuition atom IDs should be treated as references only
   - Critical contract logic should never depend on external Intuition data

2. **Identity Claims**:
   - All identity claims linking blockchain addresses to Intuition atoms should be cryptographically verified
   - Use EIP-712 typed data signatures or similar mechanisms

3. **Fallback Mechanisms**:
   - Design all systems to function even without Intuition integration
   - Include graceful degradation if Intuition services are unavailable

## Data Flow Diagram

```
┌─────────────────┐         ┌───────────────────┐         ┌─────────────────┐
│                 │         │                   │         │                 │
│  Discord Bot    │◄────────┤  Factory Contract │◄────────┤  Intuition MCP  │
│                 │         │                   │         │                 │
└────────┬────────┘         └─────────┬─────────┘         └────────┬────────┘
         │                            │                            │
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────┐         ┌───────────────────┐         ┌─────────────────┐
│                 │         │                   │         │                 │
│  User Interface │         │  Escrow Contracts │         │ Knowledge Graph │
│                 │         │                   │         │                 │
└─────────────────┘         └───────────────────┘         └─────────────────┘
```

## Conclusion

The integration between our factory contract and the Intuition knowledge graph provides a pathway to richer metadata, improved identity management, and future agent discovery capabilities. By starting with simple reference fields and optional integrations, we can build toward a more dynamic system while maintaining the security and reliability of our core blockchain operations.

This approach allows us to focus on the blockchain interactions first while creating clear extension points for Intuition integration as our multi-agent architecture evolves through the three-phase roadmap.
