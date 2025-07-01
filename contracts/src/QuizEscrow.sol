// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title QuizEscrow
 * @dev A minimal payment processor and stats tracker for Discord quiz games
 * @notice Only authorized Discord bot can record quiz results to prevent cheating
 * @notice Quiz expires after 24 hours and returns unclaimed funds to creator
 */
contract QuizEscrow {
    // ============ IMMUTABLE STATE ============
    
    /// @notice Address of the quiz creator who funded this quiz
    address public immutable creator;
    
    /// @notice Address of the authorized Discord bot (only address that can record results)
    address public immutable authorizedBot;
    
    /// @notice Timestamp when this quiz contract was created
    uint256 public immutable creationTime;
    
    /// @notice Total amount of ETH funded for this quiz
    uint256 public immutable fundingAmount;
    
    /// @notice Reward amount paid for each correct answer
    uint256 public immutable correctReward;
    
    /// @notice Reward amount paid for each incorrect answer
    uint256 public immutable incorrectReward;
    
    // ============ MUTABLE STATE ============
    
    /// @notice Total amount paid out to participants
    uint256 public totalPaidOut;
    
    /// @notice Whether the quiz has been manually ended
    bool public isEnded;
    
    /// @notice Global stats: total number of participants
    uint256 public totalParticipants;
    
    /// @notice Global stats: total correct answers across all participants
    uint256 public totalCorrectAnswers;
    
    /// @notice Global stats: total incorrect answers across all participants  
    uint256 public totalIncorrectAnswers;
    
    /// @notice Array of participant addresses for iteration
    address[] public participantsList;
    
    /// @notice Mapping to track each participant's results and payments
    mapping(address => ParticipantResult) public participantResults;
    
    // ============ STRUCTS ============
    
    struct ParticipantResult {
        uint256 correctCount;      // Number of correct answers
        uint256 incorrectCount;    // Number of incorrect answers
        uint256 totalPayout;       // Total ETH paid to this participant
        bool hasParticipated;      // Whether this address has participated
    }
    
    // ============ EVENTS ============
    
    event QuizCreated(
        address indexed creator,
        address indexed authorizedBot,
        uint256 fundingAmount,
        uint256 correctReward,
        uint256 incorrectReward
    );
    
    event QuizResultRecorded(
        address indexed participant,
        uint256 correctCount,
        uint256 incorrectCount,
        uint256 payout
    );
    
    event QuizEnded(uint256 totalParticipants, uint256 totalPaidOut);
    
    event UnclaimedFundsReturned(address indexed creator, uint256 amount);
    
    // ============ MODIFIERS ============
    
    modifier onlyAuthorizedBot() {
        require(msg.sender == authorizedBot, "QuizEscrow: Only authorized bot can call this function");
        _;
    }
    
    modifier quizNotEnded() {
        require(!isEnded, "QuizEscrow: Quiz has ended");
        require(block.timestamp < creationTime + 24 hours, "QuizEscrow: Quiz has expired");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Create a new quiz escrow contract
     * @param _creator Address of the quiz creator
     * @param _authorizedBot Address of the Discord bot authorized to record results
     * @param _correctReward Amount of ETH to pay for each correct answer
     * @param _incorrectReward Amount of ETH to pay for each incorrect answer
     */
    constructor(
        address _creator,
        address _authorizedBot,
        uint256 _correctReward,
        uint256 _incorrectReward
    ) payable {
        require(_creator != address(0), "QuizEscrow: Invalid creator address");
        require(_authorizedBot != address(0), "QuizEscrow: Invalid bot address");
        // Note: Zero funding and zero rewards are now allowed per business requirements
        
        creator = _creator;
        authorizedBot = _authorizedBot;
        creationTime = block.timestamp;
        fundingAmount = msg.value;
        correctReward = _correctReward;
        incorrectReward = _incorrectReward;
        
        emit QuizCreated(_creator, _authorizedBot, msg.value, _correctReward, _incorrectReward);
    }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @notice Record quiz results for a participant and pay rewards immediately
     * @dev Only callable by authorized bot to prevent cheating
     * @param participant Address of the quiz participant
     * @param correctCount Number of correct answers by participant
     * @param incorrectCount Number of incorrect answers by participant
     */
    function recordQuizResult(
        address participant,
        uint256 correctCount,
        uint256 incorrectCount
    ) external onlyAuthorizedBot quizNotEnded {
        require(participant != address(0), "QuizEscrow: Invalid participant address");
        require(!participantResults[participant].hasParticipated, "QuizEscrow: Participant already recorded");
        require(correctCount > 0 || incorrectCount > 0, "QuizEscrow: Must have at least one answer");
        
        // Calculate payout
        uint256 payout = (correctCount * correctReward) + (incorrectCount * incorrectReward);
        require(payout <= address(this).balance, "QuizEscrow: Insufficient funds for payout");
        
        // Record participant results
        participantResults[participant] = ParticipantResult({
            correctCount: correctCount,
            incorrectCount: incorrectCount,
            totalPayout: payout,
            hasParticipated: true
        });
        
        // Add to participants list
        participantsList.push(participant);
        
        // Update global stats
        totalParticipants++;
        totalCorrectAnswers += correctCount;
        totalIncorrectAnswers += incorrectCount;
        totalPaidOut += payout;
        
        // Pay participant immediately
        if (payout > 0) {
            (bool success, ) = participant.call{value: payout}("");
            require(success, "QuizEscrow: Payment failed");
        }
        
        emit QuizResultRecorded(participant, correctCount, incorrectCount, payout);
    }
    
    /**
     * @notice Manually end the quiz and return unclaimed funds to creator
     * @dev Can be called after 24 hours or by authorized bot anytime
     */
    function endQuiz() external {
        require(
            block.timestamp >= creationTime + 24 hours || msg.sender == authorizedBot,
            "QuizEscrow: Quiz not expired and caller not authorized bot"
        );
        require(!isEnded, "QuizEscrow: Quiz already ended");
        
        isEnded = true;
        
        // Return unclaimed funds to creator
        uint256 remainingBalance = address(this).balance;
        if (remainingBalance > 0) {
            (bool success, ) = creator.call{value: remainingBalance}("");
            require(success, "QuizEscrow: Failed to return funds to creator");
            
            emit UnclaimedFundsReturned(creator, remainingBalance);
        }
        
        emit QuizEnded(totalParticipants, totalPaidOut);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get detailed results for a specific participant
     * @param participant Address of the participant
     * @return result Struct containing participant's quiz results and payout
     */
    function getParticipantResult(address participant) external view returns (ParticipantResult memory result) {
        return participantResults[participant];
    }
    
    /**
     * @notice Get overall quiz statistics
     * @return _totalParticipants Total number of participants
     * @return _totalCorrectAnswers Total correct answers across all participants
     * @return _totalIncorrectAnswers Total incorrect answers across all participants
     * @return _totalPaidOut Total amount paid out
     * @return _remainingBalance Remaining balance available for payouts
     * @return _isExpired Whether the 24-hour period has passed
     * @return _isEnded Whether the quiz has been manually ended
     */
    function getQuizStats() external view returns (
        uint256 _totalParticipants,
        uint256 _totalCorrectAnswers,
        uint256 _totalIncorrectAnswers,
        uint256 _totalPaidOut,
        uint256 _remainingBalance,
        bool _isExpired,
        bool _isEnded
    ) {
        return (
            totalParticipants,
            totalCorrectAnswers,
            totalIncorrectAnswers,
            totalPaidOut,
            address(this).balance,
            block.timestamp >= creationTime + 24 hours,
            isEnded
        );
    }
    
    /**
     * @notice Get remaining time before quiz expires (in seconds)
     * @return remainingTime Seconds until expiry, 0 if already expired
     */
    function getRemainingTime() external view returns (uint256 remainingTime) {
        uint256 expiryTime = creationTime + 24 hours;
        if (block.timestamp >= expiryTime) {
            return 0;
        }
        return expiryTime - block.timestamp;
    }
    
    /**
     * @notice Get all participant addresses
     * @return participants Array of all participant addresses
     */
    function getAllParticipants() external view returns (address[] memory participants) {
        return participantsList;
    }
    
    /**
     * @notice Get the current balance available for payouts
     * @return balance Current contract balance in wei
     */
    function getBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }
}
