/**
 * Contract Address Management Utility
 * 
 * Provides easy access to deployed contract addresses across different networks.
 * Supports both file-based registry and environment variable fallbacks.
 */

const fs = require('fs');
const path = require('path');

class ContractAddressManager {
  constructor() {
    this.addresses = null;
    this.registryPath = path.join(__dirname, '../../contracts/deployed-addresses.json');
  }

  /**
   * Load contract addresses from registry file
   */
  loadAddresses() {
    if (this.addresses) return this.addresses;

    try {
      if (fs.existsSync(this.registryPath)) {
        this.addresses = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
      } else {
        console.warn('⚠️  Contract address registry not found, using environment variables');
        this.addresses = { networks: {} };
      }
    } catch (error) {
      console.error('❌ Error loading contract addresses:', error.message);
      this.addresses = { networks: {} };
    }

    return this.addresses;
  }

  /**
   * Get contract addresses for a specific network
   * @param {string} network - Network name (hardhat, baseSepolia, base)
   * @returns {Object} Contract addresses for the network
   */
  getAddresses(network = 'baseSepolia') {
    this.loadAddresses();

    const networkData = this.addresses.networks[network];
    if (!networkData || !networkData.contracts) {
      console.warn(`⚠️  No deployed contracts found for network: ${network}`);
      return this.getEnvironmentFallback(network);
    }

    return {
      motherFactory: networkData.contracts.motherFactory,
      quizHandler: networkData.contracts.quizHandler,
      proxyAdmin: networkData.contracts.proxyAdmin,
      chainId: networkData.chainId,
      lastDeployment: networkData.lastDeployment
    };
  }

  /**
   * Get contract addresses from environment variables as fallback
   * @param {string} network - Network name
   * @returns {Object} Contract addresses from environment
   */
  getEnvironmentFallback(network) {
    console.log(`Using environment variable fallback for network: ${network}`);
    
    return {
      motherFactory: process.env.MOTHER_FACTORY_ADDRESS || process.env.QUIZ_FACTORY_V2_ADDRESS,
      quizHandler: process.env.QUIZ_HANDLER_ADDRESS,
      chainId: this.getChainId(network),
      lastDeployment: null
    };
  }

  /**
   * Get chain ID for a network
   * @param {string} network - Network name
   * @returns {number} Chain ID
   */
  getChainId(network) {
    const chainIds = {
      hardhat: 31337,
      baseSepolia: 84532,
      base: 8453
    };
    return chainIds[network] || parseInt(process.env.CHAIN_ID || '84532');
  }

  /**
   * Get the mother factory address for a specific network
   * @param {string} network - Network name
   * @returns {string|null} Mother factory address
   */
  getMotherFactoryAddress(network = 'baseSepolia') {
    const addresses = this.getAddresses(network);
    return addresses.motherFactory;
  }

  /**
   * Get the quiz handler address for a specific network
   * @param {string} network - Network name
   * @returns {string|null} Quiz handler address
   */
  getQuizHandlerAddress(network = 'baseSepolia') {
    const addresses = this.getAddresses(network);
    return addresses.quizHandler;
  }

  /**
   * Check if contracts are deployed for a network
   * @param {string} network - Network name
   * @returns {boolean} True if contracts are deployed
   */
  areContractsDeployed(network = 'baseSepolia') {
    const addresses = this.getAddresses(network);
    return !!(addresses.motherFactory && addresses.quizHandler);
  }

  /**
   * Get deployment status summary
   * @returns {Object} Deployment status for all networks
   */
  getDeploymentStatus() {
    this.loadAddresses();
    
    const status = {};
    const networks = ['hardhat', 'baseSepolia', 'base'];
    
    networks.forEach(network => {
      const addresses = this.getAddresses(network);
      status[network] = {
        deployed: this.areContractsDeployed(network),
        addresses: addresses,
        hasEnvironmentFallback: !!(process.env.MOTHER_FACTORY_ADDRESS || process.env.QUIZ_FACTORY_V2_ADDRESS)
      };
    });
    
    return status;
  }

  /**
   * Refresh addresses from registry (reload from file)
   */
  refresh() {
    this.addresses = null;
    return this.loadAddresses();
  }
}

// Export singleton instance
const contractAddressManager = new ContractAddressManager();

module.exports = {
  ContractAddressManager,
  contractAddressManager,
  
  // Convenience functions
  getContractAddresses: (network) => contractAddressManager.getAddresses(network),
  getMotherFactoryAddress: (network) => contractAddressManager.getMotherFactoryAddress(network),
  getQuizHandlerAddress: (network) => contractAddressManager.getQuizHandlerAddress(network),
  areContractsDeployed: (network) => contractAddressManager.areContractsDeployed(network),
  getDeploymentStatus: () => contractAddressManager.getDeploymentStatus()
};
