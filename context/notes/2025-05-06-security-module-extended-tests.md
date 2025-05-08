# Security Module Extensions
**Date: May 6, 2025**

## Overview

This document details the comprehensive security extensions implemented for the Discord Quiz Bot, focusing on eight critical security domains that address advanced edge cases and vulnerabilities. These extensions significantly enhance the security posture of the application as it transitions toward a multi-agent architecture.

## 1. URL Sanitization Edge Cases

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **HTML Entity Obfuscation** | Attackers use HTML entities to bypass filters (e.g., `java&#115;cript:alert(1)`) | Enhanced decoder that recursively resolves HTML entities before validation |
| **Custom URI Schemes** | Exploitation of application-specific URI handlers (`discord://`, `steam://`) | Protocol whitelist implementation that only allows http/https schemes |
| **Double-Encoding Attacks** | Multiple layers of encoding to bypass single-decode filters | Iterative decoding process that continues until input is stable |
| **Unicode Homograph Attacks** | Using visually similar Unicode characters to masquerade malicious URLs | Punycode conversion and normalization of internationalized domain names |
| **Null Byte Injection** | Using `%00` to terminate strings and hide malicious content | Explicit null byte detection and removal before processing URLs |

### Implementation Patterns

```javascript
// Recursive HTML entity decoder
function recursiveEntityDecode(input) {
  const decoded = decodeHTMLEntities(input);
  return decoded === input ? input : recursiveEntityDecode(decoded);
}

// Protocol whitelist validator
function enforceProtocolWhitelist(url) {
  const parsedUrl = new URL(url);
  return ['http:', 'https:'].includes(parsedUrl.protocol) ? url : null;
}

// Iterative URL decoder for double-encoding
function iterativeDecode(input) {
  let previous = '';
  let current = input;
  
  while (previous !== current) {
    previous = current;
    try {
      current = decodeURIComponent(previous);
    } catch (e) {
      // Malformed URL encoding, stop iteration
      break;
    }
  }
  
  return current;
}
```

## 2. Token Amount Validation

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Precision Loss** | High-decimal tokens causing rounding errors in calculations | BigNumber/BigInt handling for precise financial calculations |
| **Gas Fee Considerations** | Transfers where gas costs exceed token value | Economic validation ensuring transfer value justifies gas expenditure |
| **Flash Loan Attacks** | Sudden large transfers indicating potential economic attacks | Rate limiting and anomaly detection for transfer amounts |
| **Token Contract Verification** | Interacting with non-compliant or fake token contracts | On-chain verification of token contract code and interfaces |

### Implementation Patterns

```javascript
// Precision-safe token amount validation
function validateTokenAmountWithPrecision(amount, decimals = 18) {
  // Convert to BigNumber to handle high precision
  const bnAmount = new BigNumber(amount);
  
  // Check if positive
  if (bnAmount.lte(0)) return false;
  
  // Check if reasonable size
  const maxSafeValue = new BigNumber(2).pow(53).minus(1);
  if (bnAmount.gt(maxSafeValue)) return false;
  
  // Check for minimum economically viable amount (dust threshold)
  const minimumViable = new BigNumber(10).pow(decimals - 6); // 0.000001 token
  if (bnAmount.lt(minimumViable)) return false;
  
  return true;
}

// Gas cost validation
async function validateEconomicViability(amount, tokenPrice, provider) {
  // Get current gas price
  const gasPrice = await provider.getGasPrice();
  
  // Approximate gas needed for token transfer
  const gasNeeded = 65000; // ERC20 transfer
  
  // Calculate gas cost in ETH
  const gasCostETH = gasPrice.mul(gasNeeded);
  
  // Token value in wei
  const tokenValueWei = ethers.utils.parseEther(
    (amount * tokenPrice).toFixed(18)
  );
  
  // Ensure value is at least 2x gas cost
  return tokenValueWei.gt(gasCostETH.mul(2));
}
```

## 3. Smart Contract Security Gaps

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Contract Upgrade Detection** | Security bypass through contract upgrades | Proxy pattern detection and implementation monitoring |
| **Cross-Function Reentrancy** | Complex attacks involving multiple functions | Global reentrancy lock instead of function-specific locks |
| **Oracle Manipulation** | Price or data feed manipulation | Time-weighted average price implementations and outlier rejection |
| **Timestamp Dependence** | Validator manipulation of block timestamps | Buffer periods for time-sensitive operations |
| **Signature Replay Protection** | Reusing signed messages across different contexts | Nonce, chain ID, and domain separation in signed messages |

### Implementation Patterns

```javascript
// Global reentrancy guard (contract pseudocode)
contract ReentrancyGuarded {
  bool private _notEntered = true;
  
  modifier nonReentrant() {
    require(_notEntered, "ReentrancyGuard: reentrant call");
    _notEntered = false;
    _;
    _notEntered = true;
  }
  
  // Apply to ALL state-changing functions
  function transfer() external nonReentrant { }
  function withdraw() external nonReentrant { }
}

// Secure price oracle consuming
function getSecurePrice(priceFeeds) {
  // Get multiple prices from different sources
  const prices = priceFeeds.map(feed => feed.getLatestPrice());
  
  // Sort prices
  prices.sort((a, b) => a - b);
  
  // Remove extremes
  const trimmedPrices = prices.slice(1, -1);
  
  // Calculate average
  return trimmedPrices.reduce((a, b) => a + b, 0) / trimmedPrices.length;
}

// EIP-712 typed signatures for replay protection
function createTypedData(message, nonce, chainId) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      QuizAction: [
        { name: 'action', type: 'string' },
        { name: 'quizId', type: 'string' },
        { name: 'param', type: 'string' },
        { name: 'nonce', type: 'uint256' }
      ]
    },
    primaryType: 'QuizAction',
    domain: {
      name: 'Quiz Bot',
      version: '1',
      chainId: chainId,
      verifyingContract: QUIZ_CONTRACT_ADDRESS
    },
    message: {
      action: message.action,
      quizId: message.quizId,
      param: message.param,
      nonce: nonce
    }
  };
}
```

## 4. Identity and Authentication Gaps

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Impersonation Attacks** | Users impersonating others with similar usernames | Multi-factor identity verification using Discord ID + wallet |
| **Signature Verification** | Lack of cryptographic proof for critical operations | ECDSA signature verification for all blockchain operations |
| **Session Management** | Security issues with multiple wallet sessions | Scope-limited session tokens with secure storage |
| **Permission Escalation** | Unauthorized privilege elevation | Fine-grained role-based access control |

### Implementation Patterns

```javascript
// Secure Discord user identifier
function createSecureUserIdentifier(discordUser, walletAddress) {
  // Combine Discord ID (not username) with wallet address
  // The Discord ID is controlled by Discord and can't be spoofed
  return `${discordUser.id}:${walletAddress.toLowerCase()}`;
}

// Permission-based action authorization
function authorizeAction(user, action, context) {
  // Role hierarchy
  const ROLES = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3
  };
  
  // Permission requirements
  const requiredRole = {
    'create_quiz': ROLES.USER,
    'approve_quiz': ROLES.MODERATOR,
    'delete_quiz': ROLES.MODERATOR,
    'ban_user': ROLES.ADMIN
  }[action];
  
  // Get user's role
  const userRole = getUserRole(user);
  
  // Check permission
  return userRole >= requiredRole;
}

// Wallet session management
class WalletSessionManager {
  constructor() {
    this.sessions = new Map();
  }
  
  createSession(userId, walletAddress, device) {
    const sessionId = crypto.randomUUID();
    const session = {
      userId,
      walletAddress,
      device,
      created: Date.now(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      lastActive: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    return sessionId;
  }
  
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Check expiration
    if (Date.now() > session.expires) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    // Update last active
    session.lastActive = Date.now();
    return session;
  }
}
```

## 5. Network and Environment Issues

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Cross-Chain Message Security** | Insecure data passing between blockchains | Cryptographic verification of cross-chain messages |
| **RPC Endpoint Security** | Compromised blockchain nodes providing false data | Multi-provider validation and response consistency checking |
| **Denial-of-Service Resilience** | Spamming attacks overwhelming services | Tiered rate limiting with user reputation tracking |
| **Network Partitioning** | Chain reorganizations causing transaction reversions | Confirmation threshold monitoring and reorg detection |
| **API Key Protection** | Insecure storage and handling of API credentials | Rotating keys with scoped permissions and access logs |

### Implementation Patterns

```javascript
// Multi-provider RPC validation
async function getValidatedBlockNumber() {
  // Query multiple providers
  const providers = [
    new ethers.providers.JsonRpcProvider(RPC_URL_1),
    new ethers.providers.JsonRpcProvider(RPC_URL_2),
    new ethers.providers.JsonRpcProvider(RPC_URL_3)
  ];
  
  // Get block numbers from all providers
  const blockNumbers = await Promise.all(
    providers.map(p => p.getBlockNumber().catch(() => null))
  );
  
  // Filter out failures
  const validBlockNumbers = blockNumbers.filter(b => b !== null);
  
  // Ensure we have enough responses
  if (validBlockNumbers.length < 2) {
    throw new Error('Insufficient provider responses');
  }
  
  // Find most common block number (consensus)
  const blockCounts = validBlockNumbers.reduce((acc, bn) => {
    acc[bn] = (acc[bn] || 0) + 1;
    return acc;
  }, {});
  
  // Get block number with most occurrences
  let maxCount = 0;
  let consensusBlock = null;
  
  for (const [block, count] of Object.entries(blockCounts)) {
    if (count > maxCount) {
      maxCount = count;
      consensusBlock = Number(block);
    }
  }
  
  return consensusBlock;
}

// Tiered rate limiting
class TieredRateLimiter {
  constructor() {
    this.limits = {
      anonymous: { requests: 10, window: 60000 },
      user: { requests: 30, window: 60000 },
      premium: { requests: 100, window: 60000 }
    };
    this.requestCounts = new Map();
  }
  
  isAllowed(userId, userTier) {
    const tier = this.limits[userTier] || this.limits.anonymous;
    const now = Date.now();
    
    // Get user's request history
    if (!this.requestCounts.has(userId)) {
      this.requestCounts.set(userId, []);
    }
    
    // Get requests within the time window
    const userRequests = this.requestCounts.get(userId);
    const recentRequests = userRequests.filter(
      time => now - time < tier.window
    );
    
    // Update request history
    this.requestCounts.set(userId, recentRequests);
    
    // Check if user is within limits
    if (recentRequests.length >= tier.requests) {
      return false;
    }
    
    // Record this request
    recentRequests.push(now);
    return true;
  }
}

// API key rotation manager
class APIKeyManager {
  constructor() {
    this.keys = new Map();
  }
  
  addKey(service, key, rotationDays = 30) {
    this.keys.set(service, {
      current: key,
      previous: null,
      rotationDate: Date.now() + (rotationDays * 24 * 60 * 60 * 1000)
    });
  }
  
  getKey(service) {
    const keyData = this.keys.get(service);
    if (!keyData) return null;
    
    // Check if rotation needed
    if (Date.now() > keyData.rotationDate) {
      this.rotateKey(service);
    }
    
    return keyData.current;
  }
  
  rotateKey(service) {
    const keyData = this.keys.get(service);
    if (!keyData) return false;
    
    // Generate new key (in production would call API)
    const newKey = generateNewApiKey();
    
    // Keep previous key briefly for transition
    keyData.previous = keyData.current;
    keyData.current = newKey;
    keyData.rotationDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
    
    return true;
  }
}
```

## 6. Quiz Content Security Gaps

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Metadata Extraction** | Hidden malicious content in metadata | Deep metadata sanitization and stripping |
| **Language-Based Attacks** | Polyglot payloads valid in multiple contexts | Context-aware sanitization for different input types |
| **Markdown Injection** | Visual attacks using markdown syntax | Markdown-specific parser and sanitizer |
| **Timing Attacks** | Information leakage through timing side channels | Constant-time operations for sensitive comparisons |
| **Recursive Content** | Stack overflows from deeply nested structures | Depth-limited recursive processing |

### Implementation Patterns

```javascript
// Deep metadata sanitization
function sanitizeQuizWithMetadata(quiz) {
  // First apply standard sanitization
  const sanitized = {...sanitizeQuizContent(quiz)};
  
  // Handle metadata specifically
  if (sanitized.metadata) {
    sanitized.metadata = sanitizeMetadata(sanitized.metadata);
  }
  
  // Process question metadata
  if (Array.isArray(sanitized.questions)) {
    sanitized.questions = sanitized.questions.map(q => {
      if (q.metadata) {
        return {...q, metadata: sanitizeMetadata(q.metadata)};
      }
      return q;
    });
  }
  
  return sanitized;
}

function sanitizeMetadata(metadata) {
  const result = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Sanitize based on key type
    if (key.includes('url') || key.includes('link')) {
      result[key] = sanitizeUrl(value);
    }
    else if (typeof value === 'string') {
      result[key] = stripHtml(value);
    }
    else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? stripHtml(item) : item
      );
    }
    else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeMetadata(value);
    }
    else {
      result[key] = value;
    }
  }
  
  return result;
}

// Markdown-specific sanitization
function sanitizeMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';
  
  // Remove potentially dangerous links
  markdown = markdown.replace(
    /\[([^\]]*)\]\s*\(\s*(?!https?:\/\/)[^\s)]+\)/gi,
    '$1'
  );
  
  // Remove script-containing links
  markdown = markdown.replace(
    /\[([^\]]*)\]\s*\(\s*(?:javascript|data|vbscript):[^)]*\)/gi,
    '$1'
  );
  
  // Remove attributes from image tags
  markdown = markdown.replace(
    /!\[([^\]]*)\]\s*\(\s*([^"')\s]+)\s*(?:"[^"]*"|'[^']*')?\s*\)/gi,
    '![$1]($2)'
  );
  
  return markdown;
}

// Depth-limited recursion
function processWithDepthLimit(obj, maxDepth = 5, process = x => x, currentDepth = 0) {
  // Base case: primitive or max depth reached
  if (typeof obj !== 'object' || obj === null || currentDepth >= maxDepth) {
    return currentDepth >= maxDepth ? {_truncated: true} : process(obj);
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => 
      processWithDepthLimit(item, maxDepth, process, currentDepth + 1)
    );
  }
  
  // Process object
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = processWithDepthLimit(
      obj[key], maxDepth, process, currentDepth + 1
    );
  }
  
  return result;
}
```

## 7. Integration Points

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Discord API Security** | Unchecked responses opening attack vectors | Schema validation for all external API responses |
| **Blockchain API Integrity** | Unverified blockchain data manipulations | Cryptographic validation of all blockchain data |
| **External Service Dependencies** | Service outages creating unavailability | Fallback services and graceful degradation |
| **Inter-Agent Communication** | Insecure data exchange between agents | Signed and authenticated agent communications |
| **MCP Protocol Security** | Protocol data manipulation | Schema validation and signature verification |

### Implementation Patterns

```javascript
// Discord API response validation
function validateDiscordAPIResponse(endpoint, response) {
  // Define expected schemas for various endpoints
  const schemas = {
    '/users/@me': {
      id: 'string',
      username: 'string',
      discriminator: 'string'
    },
    '/channels': {
      id: 'string',
      type: 'number',
      name: 'string'
    }
  };
  
  // Get schema for this endpoint
  const schema = schemas[endpoint];
  if (!schema) return false;
  
  // Check all required fields exist with correct types
  for (const [field, type] of Object.entries(schema)) {
    if (!(field in response) || typeof response[field] !== type) {
      return false;
    }
  }
  
  return true;
}

// Blockchain data verification
function verifyTransactionReceipt(receipt, expectedValues) {
  // Verify transaction hash format
  if (!ethers.utils.isHexString(receipt.transactionHash, 32)) {
    return false;
  }
  
  // Verify block hash format
  if (!ethers.utils.isHexString(receipt.blockHash, 32)) {
    return false;
  }
  
  // Verify transaction index
  if (typeof receipt.transactionIndex !== 'number') {
    return false;
  }
  
  // Verify receipt matches expected values
  for (const [key, value] of Object.entries(expectedValues)) {
    if (receipt[key] !== value) {
      return false;
    }
  }
  
  return true;
}

// External service fallback
async function fetchWithFallbacks(endpoints, fetchFn, timeout = 5000) {
  // Try each endpoint with timeout
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetchFn(endpoint, { 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.log(`Endpoint ${endpoint} failed: ${error.message}`);
      // Continue to next endpoint
    }
  }
  
  throw new Error('All endpoints failed');
}

// Secure agent communication
function createAgentMessage(fromAgent, toAgent, payload, privateKey) {
  const message = {
    from: fromAgent,
    to: toAgent,
    payload,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  // Sign the message
  const messageHash = ethers.utils.hashMessage(
    JSON.stringify(message)
  );
  const signature = new ethers.utils.SigningKey(privateKey)
    .signDigest(messageHash);
  
  return {
    ...message,
    signature: ethers.utils.joinSignature(signature)
  };
}
```

## 8. Error Handling Vulnerabilities

### Key Vulnerabilities Addressed

| Vulnerability | Description | Implementation |
|---------------|-------------|----------------|
| **Error Information Disclosure** | Sensitive data leaked in error messages | Sanitized error messages with environment-specific detail levels |
| **Error Recovery** | Inconsistent states after operation failures | Transaction patterns with atomic operations and rollbacks |
| **Exception Safety** | Unexpected exceptions causing resource leaks | Resource guards and finally blocks for cleanup |
| **Logging Security** | Unsanitized data in log files | Secure audit logging with PII removal |
| **Alert Mechanisms** | Missing detection for suspicious activity | Abnormal behavior detection with alerting |

### Implementation Patterns

```javascript
// Safe error message creator
function createSafeErrorMessage(error, isProduction) {
  // Define public-safe error types
  const publicErrors = {
    'AuthError': 'Authentication failed',
    'ValidationError': 'Input validation failed',
    'NotFoundError': 'Resource not found',
    'RateLimitError': 'Rate limit exceeded'
  };
  
  // Extract error type
  const errorType = error.constructor.name;
  
  // Create appropriate message based on environment
  if (isProduction) {
    // Only return safe, general messages
    return publicErrors[errorType] || 'An unexpected error occurred';
  } else {
    // Development environment - more details but still sanitized
    const sanitized = error.message
      .replace(/0x[a-fA-F0-9]{40}/g, '0x...') // Hide addresses
      .replace(/api[-_]?key\s*[:=]\s*["']?\w+["']?/gi, 'api_key: [REDACTED]');
      
    return {
      type: errorType,
      message: sanitized,
      stack: error.stack
    };
  }
}

// Atomic transaction pattern
async function atomicOperation(operations) {
  // Save initial state
  const initialState = saveState();
  
  try {
    // Execute all operations
    for (const operation of operations) {
      await operation();
    }
    
    return { success: true };
  } catch (error) {
    // Restore initial state
    restoreState(initialState);
    
    return {
      success: false,
      error: createSafeErrorMessage(error, isProduction())
    };
  }
}

// Resource guard pattern
function withResource(resource, action) {
  try {
    // Perform action with resource
    return action(resource);
  } finally {
    // Ensure resource is always released
    resource.release();
  }
}

// Secure audit logger
class SecureAuditLog {
  log(event, data, user) {
    // Sanitize sensitive data
    const sanitizedData = this.sanitize(data);
    const sanitizedUser = user ? { id: user.id, role: user.role } : null;
    
    // Create log entry
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      data: sanitizedData,
      user: sanitizedUser
    };
    
    // Store log
    this.store(entry);
    
    return entry;
  }
  
  sanitize(data) {
    // Define patterns to redact
    const patterns = [
      { regex: /password\s*[:=]\s*["']?[^"',\s]+["']?/g, replacement: 'password: "[REDACTED]"' },
      { regex: /secret\s*[:=]\s*["']?[^"',\s]+["']?/g, replacement: 'secret: "[REDACTED]"' },
      { regex: /token\s*[:=]\s*["']?[^"',\s]+["']?/g, replacement: 'token: "[REDACTED]"' },
      { regex: /0x[a-fA-F0-9]{40}/g, replacement: '0x[WALLET]' }
    ];
    
    // Convert to string for pattern matching
    const str = JSON.stringify(data);
    
    // Apply all patterns
    let sanitized = str;
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
    
    // Parse back to object
    return JSON.parse(sanitized);
  }
  
  store(entry) {
    // In production, would write to secure storage
    console.log('AUDIT:', entry);
  }
}
```

## Integration with Multi-Agent Architecture

These security extensions are designed to support the planned transition to a multi-agent architecture by:

1. **Establishing Clear Boundaries**: Each security domain defines clear interfaces that will become agent boundaries.

2. **Aligning with Agent Responsibilities**:
   - **Orchestrator Agent**: Uses rate limiting, error handling, and session management
   - **Quiz Agent**: Implements content sanitization and metadata validation
   - **Discord Formatting Agent**: Handles Discord API validation and UI security
   - **Solidity Auditor Agent**: Leverages contract verification and blockchain security
   - **Account Kit Agent**: Utilizes wallet validation and transaction security

3. **Communication Security**: Defines secure patterns for cross-agent communication using the A2A and MCP protocols.

## Implementation Roadmap

1. **Phase 1 (Immediate)**: Implement URL sanitization, token validation, and basic error handling.
2. **Phase 2 (Short-term)**: Add smart contract security measures and identity validation.
3. **Phase 3 (Medium-term)**: Implement integration point security and network resilience.
4. **Phase 4 (Long-term)**: Add advanced monitoring, alerting, and audit logging.

## Conclusion

The security extensions outlined in this document provide comprehensive protection against advanced attack vectors and edge cases. By implementing these measures throughout the development process, the Discord Quiz Bot will maintain a strong security posture even as it evolves toward a multi-agent architecture, ensuring the safety of user funds, data, and interactions.
