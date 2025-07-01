// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ISimpleHandler
 * @dev Interface for contract deployment handlers in the Mother Factory system
 * @notice Handlers are responsible for deploying specific contract types and managing deployment fees
 */
interface ISimpleHandler {
    /**
     * @notice Deploy a new contract instance with the provided parameters
     * @param creator Address of the original creator (to be set as contract creator)
     * @param params ABI-encoded parameters for contract deployment
     * @return contractAddress Address of the newly deployed contract
     */
    function deployContract(address creator, bytes calldata params) external payable returns (address contractAddress);
    
    /**
     * @notice Get the deployment fee required for a contract with given parameters
     * @param params ABI-encoded parameters for contract deployment
     * @return fee Required deployment fee in wei
     */
    function getDeploymentFee(bytes calldata params) external view returns (uint256 fee);
    
    /**
     * @notice Get information about this handler
     * @return contractType String identifier for the contract type this handler deploys
     * @return version Handler version string
     * @return description Human-readable description of the handler
     */
    function getHandlerInfo() external view returns (
        string memory contractType,
        string memory version, 
        string memory description
    );
}
