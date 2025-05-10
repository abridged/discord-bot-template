/**
 * Special mock implementation of ethers.js for contract-dependencies.test.js
 * This file is designed to be compatible with the inline mocking in contract-dependencies.test.js
 */

// Create a BigNumber class with comparison methods that match the expected behavior
class MockBigNumber {
  constructor(value) {
    this._value = value;
    // Add reference to self for comparison methods
    this.self = this;
  }
  
  toString() {
    return String(this._value);
  }
  
  add(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    const result = new MockBigNumber(parseFloat(this._value) + otherValue);
    return result;
  }
  
  sub(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    const result = new MockBigNumber(parseFloat(this._value) - otherValue);
    return result;
  }
  
  mul(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    const result = new MockBigNumber(parseFloat(this._value) * otherValue);
    return result;
  }
  
  div(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    const result = new MockBigNumber(parseFloat(this._value) / otherValue);
    return result;
  }
  
  lt(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    return parseFloat(this._value) < otherValue;
  }
  
  lte(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    return parseFloat(this._value) <= otherValue;
  }
  
  gt(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    return parseFloat(this._value) > otherValue;
  }
  
  gte(other) {
    const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
    return parseFloat(this._value) >= otherValue;
  }
  
  toNumber() {
    return parseFloat(this._value);
  }
  
  valueOf() {
    return parseFloat(this._value);
  }
}

// Create a special mock provider for the dependencies test
function mockSpecialProvider() {
  return {
    getNetwork: jest.fn().mockResolvedValue({ chainId: 8453, name: 'base' }),
    getBlockNumber: jest.fn().mockResolvedValue(12345678)
  };
}

// Create a special signer for the dependencies test
function mockSpecialSigner(address = '0xMockSignerAddress') {
  const provider = mockSpecialProvider();
  
  // Make sure provider.getNetwork is properly mocked
  return {
    address,
    provider,
    getAddress: jest.fn().mockResolvedValue(address),
    getNetwork: jest.fn().mockResolvedValue({ chainId: 8453, name: 'base' })
  };
}

// Create a special oracle mock for the dependencies test
function mockSpecialOracle() {
  return {
    latestRoundData: jest.fn().mockResolvedValue({
      roundId: 1,
      answer: {
        _value: '100000000', // $1 USD with 8 decimals
        lt: jest.fn().mockReturnValue(false),
        lte: jest.fn().mockReturnValue(false),
        gt: jest.fn().mockImplementation((other) => {
          const otherValue = typeof other === 'object' ? parseFloat(other._value) : parseFloat(other);
          return parseFloat('100000000') > otherValue;
        }),
        toString: jest.fn().mockReturnValue('100000000')
      },
      startedAt: Math.floor(Date.now() / 1000) - 3600,
      updatedAt: Math.floor(Date.now() / 1000),
      answeredInRound: 1
    })
  };
}

// Special mock utils
const mockUtils = {
  parseUnits: jest.fn().mockImplementation((value, decimals = 8) => {
    // Return an object that has all the expected properties and methods
    const mockObj = {
      _value: value,
      _decimals: decimals,
      toString: () => String(value),
      lt: (other) => parseFloat(value) < parseFloat(other._value || other),
      lte: (other) => parseFloat(value) <= parseFloat(other._value || other),
      gt: (other) => parseFloat(value) > parseFloat(other._value || other),
      gte: (other) => parseFloat(value) >= parseFloat(other._value || other),
      add: (other) => ({ 
        _value: parseFloat(value) + parseFloat(other._value || other),
        toString: () => String(parseFloat(value) + parseFloat(other._value || other)),
        lt: () => false,
        lte: () => false,
        gt: () => true
      }),
      mul: () => mockObj,
      div: () => mockObj
    };
    return mockObj;
  }),
  formatUnits: jest.fn().mockImplementation((value, decimals = 18) => {
    return String(value);
  }),
  isAddress: jest.fn().mockImplementation(address => {
    return typeof address === 'string' && address.startsWith('0x');
  })
};

// Helper functions specifically for contract-dependencies.test.js
function validateChainId(requestedChainId, actualChainId) {
  return String(requestedChainId) === String(actualChainId);
}

function validateEthereumAddress(address) {
  return typeof address === 'string' && address.startsWith('0x');
}

function validateTokenAmount(amount) {
  return !isNaN(amount) && amount > 0;
}

// Create this special version of the mock implementation
function overrideGlobal() {
  // This will patch the global require cache to return our mock for security/inputSanitizer
  jest.mock('../../security/inputSanitizer', () => ({
    // Redefine the validation functions inside the factory function
    validateTokenAmount: (amount) => !isNaN(amount) && amount > 0,
    validateEthereumAddress: (address) => typeof address === 'string' && address.startsWith('0x'),
    validateChainId: (requestedChainId, actualChainId) => String(requestedChainId) === String(actualChainId)
  }), { virtual: true });
}

// Export special functions for the dependencies test
module.exports = {
  MockBigNumber,
  mockBigNumber: value => new MockBigNumber(value),
  mockSpecialProvider,
  mockSpecialSigner,
  mockSpecialOracle,
  mockUtils,
  overrideGlobal,
  validateTokenAmount,
  validateEthereumAddress,
  validateChainId
};
