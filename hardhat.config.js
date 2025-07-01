/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

// Load .env file explicitly using absolute path
const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '.env') });

// Default private key for testing - NEVER use this in production
const DEFAULT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Use DEPLOYMENT_PK from .env for deployments
const PRIVATE_KEY = process.env.DEPLOYMENT_PK || DEFAULT_PRIVATE_KEY;

// Debug: Check if DEPLOYMENT_PK is loaded (only log first 10 chars for security)
if (process.env.DEPLOYMENT_PK) {
  console.log('🔍 Hardhat Config: DEPLOYMENT_PK loaded successfully (' + process.env.DEPLOYMENT_PK.substring(0, 10) + '...)');
} else {
  console.log('⚠️ Hardhat Config: DEPLOYMENT_PK not found, using default wallet');
}

// If a specific deployer address is specified, set it as an environment variable
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || null;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    // Local development network
    hardhat: {
      chainId: 31337
    },
    // Base Sepolia (testnet) - Primary development network
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: [process.env.DEPLOYMENT_PK || PRIVATE_KEY],  // Directly use env var to ensure it's the latest
      chainId: 84532,
      gasPrice: 1000000000 // 1 gwei
    },
    // Base Goerli (testnet) - Legacy
    baseGoerli: {
      url: process.env.BASE_GOERLI_RPC_URL || "https://goerli.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 84531
    },
    // Base Mainnet
    base: {
      url: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 8453
    }
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      baseGoerli: process.env.BASESCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts/src",
    tests: "./contracts/test",
    cache: "./contracts/cache",
    artifacts: "./contracts/artifacts"
  }
};
