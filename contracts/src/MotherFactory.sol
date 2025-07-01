// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./ISimpleHandler.sol";

/**
 * @title MotherFactory
 * @dev Upgradeable factory contract for deploying various contract types through registered handlers
 * @notice This contract manages deployment handlers and facilitates contract deployments with proper access control
 */
contract MotherFactory is Initializable, OwnableUpgradeable {
    // ============ STATE VARIABLES ============
    
    /// @notice Mapping from contract type to handler address
    mapping(string => address) public handlers;
    
    /// @notice Array of all registered contract types for enumeration
    string[] public contractTypes;
    
    /// @notice Mapping to track if a contract type is registered (for O(1) existence checks)
    mapping(string => bool) public isHandlerRegistered;
    
    /// @notice Mapping from user address to array of deployed contract addresses
    mapping(address => address[]) public userDeployments;
    
    /// @notice Array of all deployed contract addresses for enumeration
    address[] public allDeployedContracts;
    
    /// @notice Total number of deployed contracts
    uint256 public totalDeployed;
    
    /// @notice Address of the authorized Discord bot (only address that can deploy contracts)
    address public authorizedBot;
    
    // ============ RESERVED STORAGE SLOTS ============
    // Reserve 50 storage slots for future upgrades to avoid storage collisions
    uint256[50] private __gap;

    // ============ EVENTS ============
    
    event ContractDeployed(
        address indexed creator,
        string indexed contractType,
        address indexed contractAddress,
        address handler,
        uint256 deploymentFee
    );
    
    event HandlerRegistered(
        string indexed contractType,
        address indexed handler,
        address indexed registeredBy
    );
    
    event HandlerRemoved(
        string indexed contractType,
        address indexed handler,
        address indexed removedBy
    );
    
    event AuthorizedBotUpdated(
        address indexed oldBot,
        address indexed newBot,
        address indexed updatedBy
    );
    
    // ============ MODIFIERS ============
    
    modifier validHandler(string memory contractType) {
        require(handlers[contractType] != address(0), "MotherFactory: Handler not registered for contract type");
        _;
    }
    
    modifier onlyAuthorizedBot() {
        require(msg.sender == authorizedBot, "MotherFactory: Only authorized bot can deploy contracts");
        _;
    }
    
    // ============ CONSTRUCTOR/INITIALIZER ============
    
    /**
     * @notice Initialize the MotherFactory contract (replaces constructor for proxy pattern)
     * @param _authorizedBot Address of the Discord bot authorized to deploy contracts
     */
    function initialize(address _authorizedBot) public initializer {
        __Ownable_init(_msgSender());
        require(_authorizedBot != address(0), "MotherFactory: Invalid bot address");
        authorizedBot = _authorizedBot;
    }
    
    // ============ CORE DEPLOYMENT FUNCTIONS ============
    
    /**
     * @notice Deploy a contract of the specified type using the registered handler
     * @param contractType String identifier for the type of contract to deploy
     * @param params ABI-encoded parameters for the contract deployment
     * @return contractAddress Address of the newly deployed contract
     */
    function deployContract(
        string memory contractType,
        bytes memory params
    ) external payable validHandler(contractType) returns (address contractAddress) {
        address handlerAddress = handlers[contractType];
        ISimpleHandler handler = ISimpleHandler(handlerAddress);
        
        // Get required deployment fee
        uint256 requiredFee = handler.getDeploymentFee(params);
        require(msg.value >= requiredFee, "MotherFactory: Insufficient payment for deployment fee");
        
        // Deploy contract through handler
        contractAddress = handler.deployContract{value: msg.value}(msg.sender, params);
        require(contractAddress != address(0), "MotherFactory: Contract deployment failed");
        
        // Track deployed contract
        userDeployments[msg.sender].push(contractAddress);
        allDeployedContracts.push(contractAddress);
        totalDeployed++;
        
        emit ContractDeployed(
            msg.sender,
            contractType,
            contractAddress,
            handlerAddress,
            requiredFee
        );
        
        return contractAddress;
    }
    
    /**
     * @notice Get the deployment fee for a contract type with given parameters
     * @param contractType String identifier for the type of contract
     * @param params ABI-encoded parameters for the contract deployment
     * @return fee Required deployment fee in wei
     */
    function getDeploymentFee(
        string memory contractType,
        bytes memory params
    ) external view validHandler(contractType) returns (uint256 fee) {
        address handlerAddress = handlers[contractType];
        ISimpleHandler handler = ISimpleHandler(handlerAddress);
        return handler.getDeploymentFee(params);
    }
    
    // ============ HANDLER MANAGEMENT ============
    
    /**
     * @notice Register a new handler for a contract type
     * @param contractType String identifier for the contract type
     * @param handlerAddress Address of the handler contract
     */
    function registerHandler(
        string memory contractType,
        address handlerAddress
    ) external onlyOwner {
        require(handlerAddress != address(0), "MotherFactory: Invalid handler address");
        require(bytes(contractType).length > 0, "MotherFactory: Contract type cannot be empty");
        
        // Check if this is a new contract type
        bool isNewType = handlers[contractType] == address(0);
        
        handlers[contractType] = handlerAddress;
        isHandlerRegistered[contractType] = true;
        
        // Add to contract types array if new
        if (isNewType) {
            contractTypes.push(contractType);
        }
        
        emit HandlerRegistered(contractType, handlerAddress, msg.sender);
    }
    
    /**
     * @notice Remove a handler for a contract type
     * @param contractType String identifier for the contract type
     */
    function removeHandler(string memory contractType) external onlyOwner validHandler(contractType) {
        address handlerAddress = handlers[contractType];
        handlers[contractType] = address(0);
        isHandlerRegistered[contractType] = false;
        
        // Remove from contractTypes array
        for (uint256 i = 0; i < contractTypes.length; i++) {
            if (keccak256(bytes(contractTypes[i])) == keccak256(bytes(contractType))) {
                contractTypes[i] = contractTypes[contractTypes.length - 1];
                contractTypes.pop();
                break;
            }
        }
        
        emit HandlerRemoved(contractType, handlerAddress, msg.sender);
    }
    
    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update the authorized bot address (owner only)
     * @param newBot Address of the new authorized Discord bot
     */
    function setAuthorizedBot(address newBot) external onlyOwner {
        require(newBot != address(0), "MotherFactory: Invalid bot address");
        address oldBot = authorizedBot;
        authorizedBot = newBot;
        emit AuthorizedBotUpdated(oldBot, newBot, msg.sender);
    }
    
    // ============ OWNERSHIP MANAGEMENT ============

    /**
     * @notice Transfer ownership of the factory to a new address
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != owner(), "MotherFactory: New owner cannot be current owner");
        
        super.transferOwnership(newOwner);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get the handler address for a contract type
     * @param contractType String identifier for the contract type
     * @return handlerAddress Address of the registered handler
     */
    function getHandler(string memory contractType) external view returns (address handlerAddress) {
        return handlers[contractType];
    }
    
    /**
     * @notice Get information about a registered handler
     * @param contractType String identifier for the contract type
     * @return contractTypeReturned Contract type string from handler
     * @return version Handler version string
     * @return description Handler description string
     */
    function getHandlerInfo(string memory contractType) external view validHandler(contractType) returns (
        string memory contractTypeReturned,
        string memory version,
        string memory description
    ) {
        address handlerAddress = handlers[contractType];
        ISimpleHandler handler = ISimpleHandler(handlerAddress);
        return handler.getHandlerInfo();
    }
    
    /**
     * @notice Get all registered contract types
     * @return types Array of contract type strings
     */
    function getContractTypes() external view returns (string[] memory types) {
        return contractTypes;
    }
    
    /**
     * @notice Get contracts deployed by a specific creator
     * @param creator Address of the contract creator
     * @return contracts Array of contract addresses deployed by creator
     */
    function getDeployedContracts(address creator) external view returns (address[] memory contracts) {
        return userDeployments[creator];
    }
    
    /**
     * @notice Get all contracts deployed through this factory
     * @return contracts Array of all deployed contract addresses
     */
    function getAllDeployedContracts() external view returns (address[] memory contracts) {
        return allDeployedContracts;
    }
    
    /**
     * @notice Get deployment statistics
     * @return _totalDeployed Total number of contracts deployed
     * @return _totalHandlers Total number of registered handlers
     * @return _currentOwner Current owner address
     */
    function getFactoryStats() external view returns (
        uint256 _totalDeployed,
        uint256 _totalHandlers,
        address _currentOwner
    ) {
        return (
            totalDeployed,
            contractTypes.length,
            owner()
        );
    }
    
    /**
     * @notice Check if a handler is registered for a given contract type
     * @param contractType Type of contract to check
     * @return isRegistered True if handler is registered, false otherwise
     */
    function isHandlerActive(string memory contractType) external view returns (bool isRegistered) {
        return isHandlerRegistered[contractType];
    }
}
