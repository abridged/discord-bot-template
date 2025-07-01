#!/usr/bin/env node

/**
 * Generate a valid checksummed Ethereum address for testing
 */

const { ethers } = require('ethers');

// Generate a random wallet and get its properly checksummed address
const wallet = ethers.Wallet.createRandom();
console.log('✅ Valid checksummed address:', wallet.address);
console.log('🔑 Private key (for reference):', wallet.privateKey);
