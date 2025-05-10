/**
 * Tests for the ethersjs.special.js mock implementation
 */

const { 
  MockBigNumber, 
  mockBigNumber, 
  mockSpecialProvider, 
  mockSpecialSigner, 
  mockSpecialOracle, 
  validateTokenAmount, 
  validateEthereumAddress, 
  validateChainId 
} = require('./ethersjs.special');

describe('Special Ethers.js Mock Module', () => {
  test('should create BigNumber instances with proper methods', () => {
    const num = mockBigNumber(100);
    expect(num).toBeInstanceOf(MockBigNumber);
    expect(num._value).toBe(100);
    expect(num.toString()).toBe('100');
  });

  test('mockSpecialProvider should return expected functions', () => {
    const provider = mockSpecialProvider();
    expect(provider.getNetwork).toBeDefined();
    expect(typeof provider.getNetwork).toBe('function');
    expect(provider.getBlockNumber).toBeDefined();
    expect(typeof provider.getBlockNumber).toBe('function');
  });

  test('mockSpecialSigner should create signer with custom address', () => {
    const customAddress = '0xCustomAddress';
    const signer = mockSpecialSigner(customAddress);
    expect(signer.address).toBe(customAddress);
    expect(signer.getAddress).toBeDefined();
    expect(signer.provider).toBeDefined();
  });

  test('validateTokenAmount should check amounts correctly', () => {
    expect(validateTokenAmount(100)).toBe(true);
    expect(validateTokenAmount(0)).toBe(false);
    expect(validateTokenAmount(-1)).toBe(false);
  });

  test('validateEthereumAddress should check addresses correctly', () => {
    expect(validateEthereumAddress('0x123456789abcdef')).toBe(true);
    expect(validateEthereumAddress('not-an-address')).toBe(false);
    expect(validateEthereumAddress(null)).toBe(false);
  });

  test('validateChainId should compare chain IDs correctly', () => {
    expect(validateChainId(1, 1)).toBe(true);
    expect(validateChainId('1', 1)).toBe(true);
    expect(validateChainId(1, 2)).toBe(false);
  });
});
