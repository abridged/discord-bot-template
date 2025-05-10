/**
 * Tests for the ethersjs.js mock implementation
 */

const { ethers } = require('./ethersjs');

describe('Ethers.js Mock Module', () => {
  test('should export ethers object', () => {
    expect(ethers).toBeDefined();
    expect(ethers.utils).toBeDefined();
    expect(ethers.BigNumber).toBeDefined();
    expect(ethers.providers).toBeDefined();
  });
  
  test('should have working utils functions', () => {
    const result = ethers.utils.parseEther('1.0');
    expect(result).toBeDefined();
    expect(ethers.utils.formatEther(result)).toBe('1');
  });
});
