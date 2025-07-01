// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./QuizEscrow.sol";
import "./ISimpleHandler.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title QuizHandler
 * @dev Handler contract for deploying QuizEscrow contracts via MotherFactory
 * @notice Manages deployment fees and parameters for quiz creation
 */
contract QuizHandler is ISimpleHandler, Initializable {
    // ============ IMMUTABLE/CONSTANT STATE ============
    
    /// @notice Fixed deployment fee for creating a quiz (0.001 ETH)
    uint256 public constant DEPLOYMENT_FEE = 0.001 ether;
    
    /// @notice Version string for this handler
    string public constant VERSION = "1.0.0";
    
    // ============ MUTABLE STATE ============
    
    /// @notice Address of the Discord bot authorized for all deployed quizzes
    address public authorizedBot;
    
    // ============ EVENTS ============
    
    event QuizDeployed(
        address indexed creator,
        address indexed quizAddress,
        uint256 correctReward,
        uint256 incorrectReward,
        uint256 fundingAmount,
        uint256 deploymentFee
    );
    
    // ============ INITIALIZER (PROXY PATTERN) ============
    
    /**
     * @notice Initialize the QuizHandler (replaces constructor for proxy pattern)
     * @param _authorizedBot Address of the Discord bot authorized for all deployed quizzes
     */
    function initialize(address _authorizedBot) public initializer {
        require(_authorizedBot != address(0), "QuizHandler: Invalid bot address");
        authorizedBot = _authorizedBot;
    }
    
    // ============ INTERFACE IMPLEMENTATION ============
    
    /**
     * @notice Deploy a new QuizEscrow contract with the provided parameters
     * @param creator Address of the original creator (to be set as contract creator)
     * @param params ABI-encoded quiz parameters (correctReward, incorrectReward)
     * @return contractAddress Address of the newly deployed QuizEscrow contract
     */
    function deployContract(address creator, bytes calldata params) external payable override returns (address contractAddress) {
        // Decode parameters
        (uint256 correctReward, uint256 incorrectReward) = abi.decode(params, (uint256, uint256));
        
        // Validate minimum payment covers deployment fee
        require(msg.value >= DEPLOYMENT_FEE, "QuizHandler: Insufficient payment for deployment fee");
        
        // Calculate quiz funding (payment minus deployment fee)
        // Note: quizFunding can be zero if only deployment fee is paid
        uint256 quizFunding = msg.value - DEPLOYMENT_FEE;
        
        // Deploy QuizEscrow contract with funding
        QuizEscrow quiz = new QuizEscrow{value: quizFunding}(
            creator,     // Pass the original creator
            authorizedBot,
            correctReward,
            incorrectReward
        );
        
        contractAddress = address(quiz);
        
        emit QuizDeployed(
            creator,
            contractAddress,
            correctReward,
            incorrectReward,
            quizFunding,
            DEPLOYMENT_FEE
        );
        
        return contractAddress;
    }
    
    /**
     * @notice Get the deployment fee for a quiz with given parameters
     * @param params ABI-encoded parameters (unused for quiz handler)
     * @return fee Required deployment fee in wei
     */
    function getDeploymentFee(bytes calldata params) external pure override returns (uint256 fee) {
        // Parameters unused for quiz handler - fee is constant
        params; // Silence unused parameter warning
        return DEPLOYMENT_FEE;
    }
    
    /**
     * @notice Get information about this handler
     * @return contractType String identifier for the contract type
     * @return version Handler version string
     * @return description Human-readable description
     */
    function getHandlerInfo() external pure override returns (
        string memory contractType,
        string memory version,
        string memory description
    ) {
        return (
            "QuizEscrow",
            VERSION,
            "Deploys QuizEscrow contracts for Discord quiz games with bot-controlled result recording"
        );
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get the authorized bot address for all deployed quizzes
     * @return bot Address of the authorized Discord bot
     */
    function getAuthorizedBot() external view returns (address bot) {
        return authorizedBot;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Withdraw accumulated deployment fees (owner only)
     * @dev Only callable by contract deployer
     */
    function withdrawFees() external {
        require(msg.sender == authorizedBot, "QuizHandler: Only authorized bot can withdraw fees");
        uint256 balance = address(this).balance;
        require(balance > 0, "QuizHandler: No fees to withdraw");
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "QuizHandler: Fee withdrawal failed");
    }
    
    /**
     * @notice Get current balance of accumulated deployment fees
     * @return balance Current contract balance in wei
     */
    function getAccumulatedFees() external view returns (uint256 balance) {
        return address(this).balance;
    }
}
