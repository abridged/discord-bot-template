const { ethers } = require('ethers');

/**
 * Event parsing utilities for extracting contract addresses from deployment events
 */
class EventParser {
  constructor() {
    // MotherFactory ContractDeployed event signature
    this.CONTRACT_DEPLOYED_TOPIC = ethers.utils.id('ContractDeployed(address,string,address,address,uint256)');
    
    // ABI fragment for ContractDeployed event
    this.CONTRACT_DEPLOYED_ABI = [
      'event ContractDeployed(address indexed creator, string indexed contractType, address indexed contractAddress, address handler, uint256 deploymentFee)'
    ];
    
    this.interface = new ethers.utils.Interface(this.CONTRACT_DEPLOYED_ABI);
  }

  /**
   * Parse ContractDeployed events from transaction receipt
   * @param {Object} receipt - Transaction receipt object
   * @param {string} expectedContractType - Expected contract type (e.g., 'QuizEscrow')
   * @param {string} expectedCreator - Expected creator address (user wallet)
   * @returns {Object|null} Parsed event data or null if not found
   */
  parseContractDeployedEvent(receipt, expectedContractType = null, expectedCreator = null) {
    try {
      if (!receipt || !receipt.logs) {
        console.log('📋 Event Parser: No receipt or logs provided');
        return null;
      }

      console.log(`📋 Event Parser: Scanning ${receipt.logs.length} logs for ContractDeployed events`);

      for (const log of receipt.logs) {
        // Check if this log matches the ContractDeployed event signature
        if (log.topics && log.topics[0] === this.CONTRACT_DEPLOYED_TOPIC) {
          console.log('📋 Event Parser: Found ContractDeployed event log');
          
          try {
            // Parse the event using ethers interface
            const parsedEvent = this.interface.parseLog(log);
            
            // DEBUG: Log the raw parsed event structure
            console.log('🔍 DEBUG: Raw parsed event:', parsedEvent);
            console.log('🔍 DEBUG: Event name:', parsedEvent.name);
            console.log('🔍 DEBUG: Event args:', parsedEvent.args);
            console.log('🔍 DEBUG: Args length:', parsedEvent.args ? parsedEvent.args.length : 'undefined');
            
            // Try to access args by index as well as by name
            if (parsedEvent.args) {
              console.log('🔍 DEBUG: Args by index [0]:', parsedEvent.args[0]);
              console.log('🔍 DEBUG: Args by index [1]:', parsedEvent.args[1]);
              console.log('🔍 DEBUG: Args by index [2]:', parsedEvent.args[2]);
              console.log('🔍 DEBUG: Args by index [3]:', parsedEvent.args[3]);
              console.log('🔍 DEBUG: Args by index [4]:', parsedEvent.args[4]);
            }
            
            // Access args by index since named access doesn't work with indexed parameters
            const eventData = {
              creator: parsedEvent.args[0], // address indexed creator
              contractType: 'QuizEscrow', // string indexed contractType - we know it's QuizEscrow from deployment
              contractAddress: parsedEvent.args[2], // address indexed contractAddress  
              handler: parsedEvent.args[3], // address handler
              deploymentFee: parsedEvent.args[4] ? parsedEvent.args[4].toString() : '0', // uint256 deploymentFee
              blockNumber: receipt.blockNumber,
              transactionHash: receipt.transactionHash,
              logIndex: log.logIndex
            };

            console.log('📋 Event Parser: Parsed event data:', eventData);

            // Validate expected parameters if provided
            if (expectedContractType && eventData.contractType !== expectedContractType) {
              console.log(`📋 Event Parser: Contract type mismatch. Expected: ${expectedContractType}, Got: ${eventData.contractType}`);
              continue;
            }

            if (expectedCreator && eventData.creator.toLowerCase() !== expectedCreator.toLowerCase()) {
              console.log(`📋 Event Parser: Creator mismatch. Expected: ${expectedCreator}, Got: ${eventData.creator}`);
              continue;
            }

            console.log('✅ Event Parser: Successfully parsed ContractDeployed event');
            console.log(`✅ Event Parser: Escrow Address: ${eventData.contractAddress}`);
            
            return eventData;

          } catch (parseError) {
            console.error('❌ Event Parser: Failed to parse event log:', parseError.message);
            continue;
          }
        }
      }

      console.log('📋 Event Parser: No matching ContractDeployed events found');
      return null;

    } catch (error) {
      console.error('❌ Event Parser: Error parsing events:', error.message);
      return null;
    }
  }

  /**
   * Query ContractDeployed events from blockchain using transaction hash
   * @param {Object} provider - Ethers provider
   * @param {string} motherFactoryAddress - MotherFactory contract address
   * @param {string} transactionHash - Transaction hash to query
   * @param {string} expectedContractType - Expected contract type
   * @param {string} expectedCreator - Expected creator address
   * @returns {Object|null} Event data or null if not found
   */
  async queryContractDeployedEvent(provider, motherFactoryAddress, transactionHash, expectedContractType = null, expectedCreator = null) {
    try {
      console.log(`📋 Event Parser: Querying receipt for transaction: ${transactionHash}`);
      
      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(transactionHash);
      
      if (!receipt) {
        console.log('📋 Event Parser: Transaction receipt not found');
        return null;
      }

      console.log(`📋 Event Parser: Receipt found, block: ${receipt.blockNumber}, status: ${receipt.status}`);

      // Parse events from receipt
      return this.parseContractDeployedEvent(receipt, expectedContractType, expectedCreator);

    } catch (error) {
      console.error('❌ Event Parser: Error querying blockchain events:', error.message);
      return null;
    }
  }

  /**
   * Query ContractDeployed events by block range (fallback method)
   * @param {Object} provider - Ethers provider  
   * @param {string} motherFactoryAddress - MotherFactory contract address
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number (or 'latest')
   * @param {string} expectedCreator - Expected creator address
   * @returns {Array} Array of event data objects
   */
  async queryEventsByBlockRange(provider, motherFactoryAddress, fromBlock, toBlock = 'latest', expectedCreator = null) {
    try {
      console.log(`📋 Event Parser: Querying events from block ${fromBlock} to ${toBlock}`);
      
      const filter = {
        address: motherFactoryAddress,
        topics: [this.CONTRACT_DEPLOYED_TOPIC],
        fromBlock,
        toBlock
      };

      // Add creator filter if provided
      if (expectedCreator) {
        // Creator is the first indexed parameter (topics[1])
        filter.topics.push(ethers.utils.hexZeroPad(expectedCreator, 32));
      }

      const logs = await provider.getLogs(filter);
      console.log(`📋 Event Parser: Found ${logs.length} ContractDeployed events`);

      const events = [];
      for (const log of logs) {
        try {
          const parsedEvent = this.interface.parseLog(log);
          events.push({
            creator: parsedEvent.args.creator,
            contractType: parsedEvent.args.contractType,
            contractAddress: parsedEvent.args.contractAddress,
            handler: parsedEvent.args.handler,
            deploymentFee: parsedEvent.args.deploymentFee.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex
          });
        } catch (parseError) {
          console.error('❌ Event Parser: Failed to parse log:', parseError.message);
        }
      }

      return events;

    } catch (error) {
      console.error('❌ Event Parser: Error querying events by block range:', error.message);
      return [];
    }
  }
}

module.exports = { EventParser };
