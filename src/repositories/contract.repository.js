/**
 * Contract Repository
 * Handles database operations for smart contract addresses and metadata
 */

const { sequelize, DataTypes } = require('../database/models');

/**
 * Create the Contract table in the database if it doesn't exist
 */
async function createContractTable() {
  try {
    // Define the Contract model if it doesn't exist
    if (!sequelize.models.Contract) {
      sequelize.define('Contract', {
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        address: {
          type: DataTypes.STRING,
          allowNull: false
        },
        chainId: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        deploymentTx: {
          type: DataTypes.STRING,
          allowNull: true
        },
        deployedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        abi: {
          type: DataTypes.TEXT,
          allowNull: true
        }
      }, {
        indexes: [
          {
            unique: true,
            fields: ['name', 'chainId'] // Each contract name should be unique per chain
          }
        ]
      });
    }
    
    // Sync the model with the database
    await sequelize.models.Contract.sync();
    console.log('Contract table created or already exists');
    return true;
  } catch (error) {
    console.error('Error creating Contract table:', error);
    throw error;
  }
}

/**
 * Save contract information to the database
 * @param {Object} contractData Contract data to save
 * @returns {Promise<Object>} Saved contract data
 */
async function saveContract(contractData) {
  try {
    await createContractTable();
    const Contract = sequelize.models.Contract;
    
    // Create or update the contract record
    const [contract, created] = await Contract.upsert(contractData);
    
    return contract;
  } catch (error) {
    console.error('Error saving contract:', error);
    throw error;
  }
}

/**
 * Get contract address by name and chain ID
 * @param {string} name Contract name
 * @param {number} chainId Blockchain chain ID
 * @returns {Promise<Object|null>} Contract data or null if not found
 */
async function getContractByNameAndChain(name, chainId) {
  try {
    await createContractTable();
    const Contract = sequelize.models.Contract;
    
    // Find the contract by name and chain ID
    const contract = await Contract.findOne({
      where: {
        name,
        chainId
      }
    });
    
    return contract;
  } catch (error) {
    console.error('Error getting contract:', error);
    throw error;
  }
}

/**
 * Get all contracts by chain ID
 * @param {number} chainId Blockchain chain ID
 * @returns {Promise<Array>} Array of contract data
 */
async function getContractsByChain(chainId) {
  try {
    await createContractTable();
    const Contract = sequelize.models.Contract;
    
    // Find all contracts for the specified chain
    const contracts = await Contract.findAll({
      where: {
        chainId
      }
    });
    
    return contracts;
  } catch (error) {
    console.error('Error getting contracts by chain:', error);
    throw error;
  }
}

/**
 * Get the QuizFactory contract address for a specific chain
 * @param {number} chainId Blockchain chain ID
 * @returns {Promise<string|null>} Contract address or null if not found
 */
async function getQuizFactoryAddress(chainId) {
  try {
    const contract = await getContractByNameAndChain('QuizFactory', chainId);
    return contract ? contract.address : null;
  } catch (error) {
    console.error('Error getting QuizFactory address:', error);
    throw error;
  }
}

module.exports = {
  createContractTable,
  saveContract,
  getContractByNameAndChain,
  getContractsByChain,
  getQuizFactoryAddress
};
