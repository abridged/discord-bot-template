const { configureClient, API_URL_DEV } = require('@0xintuition/graphql');
const { getEthMultiVaultAddressFromChainId } = require('@0xintuition/sdk');
const { createPublicClient, createWalletClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config();

// Configure GraphQL client (dev by default)
configureClient({
  apiUrl: process.env.INTUITION_GRAPHQL_URL || API_URL_DEV
});

// Wallet/account for the Quiz Agent identity
const agentPrivateKey = process.env.INTUITION_PRIVATE_KEY;
if (!agentPrivateKey) {
  console.warn('[Intuition] Missing INTUITION_PRIVATE_KEY; write operations will be disabled');
}

const account = agentPrivateKey ? privateKeyToAccount(`0x${agentPrivateKey.replace(/^0x/, '')}`) : undefined;

const rpcUrl = process.env.INTUITION_RPC_URL || process.env.RPC_URL || 'https://sepolia.base.org';

const walletClient = account
  ? createWalletClient({ chain: baseSepolia, transport: http(rpcUrl), account })
  : undefined;

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });

module.exports = {
  account,
  walletClient,
  publicClient,
  address: getEthMultiVaultAddressFromChainId(baseSepolia.id),
  chainId: baseSepolia.id,
  rpcUrl
};


