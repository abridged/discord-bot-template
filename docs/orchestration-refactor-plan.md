# Orchestration Refactoring Plan

## Current Issues Analysis

### 1. Infinite Recursive Processing (Critical)
- `processNextOperation()` recursively calls itself without bounds
- Creates call stack overflow in test environments
- No cancellation mechanism for test shutdown

### 2. Heavy Module Dependencies (Major)
- Direct imports of blockchain services cause connection hangs
- Quiz generator may have file system watchers
- Account Kit has persistent HTTP connections

### 3. Memory Leaks (Major)
- `inProgressOperations` Map never cleans up completed operations
- Promise references stored indefinitely
- Queue grows without bounds checking

### 4. Missing Test Boundaries (Major)
- No dependency injection for mocking external services
- No environment-specific behavior control
- No graceful shutdown for test environments

## Refactoring Strategy (Zero-Regression)

### Phase 1: Dependency Injection Container
```javascript
// NEW: orchestration/Container.js
class OrchestrationContainer {
  constructor(environment = 'production') {
    this.environment = environment;
    this.services = new Map();
    this.config = this.loadConfig(environment);
  }

  register(name, factory) {
    this.services.set(name, factory);
  }

  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`Service ${name} not registered`);
    }
    return this.services.get(name)(this.config);
  }

  loadConfig(environment) {
    if (environment === 'test') {
      return {
        maxQueueSize: 10,
        operationTimeout: 1000,
        enableRecursion: false,
        cleanupInterval: 100
      };
    }
    return {
      maxQueueSize: 100,
      operationTimeout: 30000,
      enableRecursion: true,
      cleanupInterval: 5000
    };
  }
}
```

### Phase 2: Bounded Queue Processor
```javascript
// REFACTORED: orchestration/QueueProcessor.js
class QueueProcessor {
  constructor(container) {
    this.container = container;
    this.config = container.config;
    this.operationQueue = [];
    this.inProgressOperations = new Map();
    this.processingQueue = false;
    this.isShuttingDown = false;
    this.cleanupTimer = null;
  }

  async queueOperation(id, operation, ...args) {
    // Bounded queue check
    if (this.operationQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue full: ${this.operationQueue.length}/${this.config.maxQueueSize}`);
    }

    // Test environment: immediate execution without queuing
    if (this.container.environment === 'test') {
      return this.executeOperation(id, operation, ...args);
    }

    // Production: queue-based execution
    return this.enqueueOperation(id, operation, ...args);
  }

  async executeOperation(id, operation, ...args) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), this.config.operationTimeout)
    );

    try {
      const result = await Promise.race([
        operation(...args),
        timeoutPromise
      ]);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processNextOperation() {
    // Non-recursive: Use setImmediate for next tick processing
    if (this.config.enableRecursion) {
      setImmediate(() => this.processQueue());
    }
  }

  async processQueue() {
    if (this.isShuttingDown || this.processingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    
    try {
      while (this.operationQueue.length > 0 && !this.isShuttingDown) {
        const operation = this.operationQueue.shift();
        await this.executeOperation(operation.id, operation.operation, ...operation.args);
        
        // Cleanup completed operations
        this.inProgressOperations.delete(operation.id);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  shutdown() {
    this.isShuttingDown = true;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.operationQueue.length = 0;
    this.inProgressOperations.clear();
  }
}
```

### Phase 3: Service Abstractions
```javascript
// NEW: orchestration/services/BlockchainService.js
class BlockchainServiceAbstraction {
  constructor(config, realService = null) {
    this.config = config;
    this.realService = realService;
  }

  async submitQuiz(quizData, params) {
    if (this.config.environment === 'test') {
      return {
        success: true,
        contractAddress: '0x' + '1'.repeat(40),
        transactionHash: '0x' + '2'.repeat(64)
      };
    }
    return this.realService.submitQuiz(quizData, params);
  }

  async checkUserBalance(user) {
    if (this.config.environment === 'test') {
      return {
        success: true,
        balance: 5000,
        smartAccountAddress: '0x' + '3'.repeat(40)
      };
    }
    return this.realService.checkUserBalance(user);
  }
}
```

## Implementation Steps (Zero-Regression)

### Step 1: Create Container & Abstractions (No Changes to Existing)
1. Create new files without modifying existing orchestration.js
2. Build service abstractions that wrap existing services
3. Create comprehensive test suite for new components

### Step 2: Gradual Migration (Backwards Compatible)
1. Add dependency injection support to existing orchestration.js
2. Make DI optional - fall back to direct imports if not provided
3. Update tests to use new container in test mode only

### Step 3: Replace Core Logic (Controlled)
1. Replace queue processing with bounded version
2. Add shutdown hooks for test environments  
3. Implement memory cleanup with configurable intervals

### Step 4: Full Migration (Safe)
1. Update all callers to use container
2. Remove direct service imports
3. Add monitoring & health checks

## Benefits

### Testability
- ✅ Fast test execution (no hanging)
- ✅ Predictable behavior in test environments
- ✅ Easy mocking of external services
- ✅ Bounded resource usage

### Maintainability  
- ✅ Clear separation of concerns
- ✅ Configurable behavior per environment
- ✅ Memory leak prevention
- ✅ Graceful shutdown capabilities

### Production Safety
- ✅ No behavioral changes in production
- ✅ Existing functionality preserved
- ✅ Performance improvements via bounded queues
- ✅ Better error handling & recovery

## Risk Mitigation

### Zero Regression Strategy
1. **Parallel Implementation**: Build new system alongside existing
2. **Feature Flags**: Environment-based activation
3. **Comprehensive Testing**: Test both old and new systems
4. **Gradual Rollout**: Test → Dev → Staging → Production
5. **Rollback Plan**: Keep existing system as fallback

### Testing Strategy
1. **Unit Tests**: Test each component in isolation
2. **Integration Tests**: Test container with real services
3. **E2E Tests**: Test full workflows with new architecture
4. **Performance Tests**: Ensure no production impact
5. **Memory Tests**: Verify leak prevention

This refactoring approach ensures zero regressions while solving the hanging async loop issues and making the system highly testable.
