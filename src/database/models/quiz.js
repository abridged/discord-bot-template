const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Quiz extends Model {
    static associate(models) {
      // define associations here
      Quiz.hasMany(models.Question, {
        foreignKey: 'quizId',
        as: 'questions',
        onDelete: 'CASCADE'
      });
      
      Quiz.hasMany(models.Answer, {
        foreignKey: 'quizId',
        as: 'answers',
        onDelete: 'CASCADE'
      });
    }
  }
  
  Quiz.init({
    guildId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord guild/server ID this quiz belongs to'
    },
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    creatorDiscordId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    creatorWalletAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sourceUrl: {
      type: DataTypes.STRING,
      allowNull: false
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: false
    },
    questionCount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tokenAddress: {
      type: DataTypes.STRING,
      allowNull: false
    },
    chainId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rewardAmount: {
      type: DataTypes.STRING, // Storing as string to handle large numbers
      allowNull: false
    },
    correctRewardPoints: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 75,
      comment: 'Points awarded for correct answers'
    },
    incorrectRewardPoints: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 25,
      comment: 'Points awarded for incorrect answers'
    },
    fundingStatus: {
      type: DataTypes.ENUM('unfunded', 'pending', 'funded', 'distributing', 'distributed'),
      defaultValue: 'unfunded',
      allowNull: false
    },
    treasuryWalletAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fundingTransactionHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    distributionTransactionHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    distributedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    quizHash: {
      type: DataTypes.STRING,
      allowNull: true // Will be used for blockchain verification later
    },
    escrowAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Ethereum address of the deployed quiz escrow contract'
    },
    transactionHash: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Transaction hash of the escrow contract deployment'
    },
    onChain: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the quiz has been deployed on-chain'
    },
    expiryTime: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Unix timestamp when the quiz expires on-chain'
    },
    // ============ CONTRACT INTEGRATION FIELDS ============
    // Added for new contract architecture compatibility
    botRecordingStatus: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      allowNull: true, // Allow null for existing records
      defaultValue: null,
      comment: 'Status of bot recording quiz results on-chain'
    },
    participantCount: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for existing records
      defaultValue: 0,
      comment: 'Number of participants who completed the quiz'
    },
    totalPaidOut: {
      type: DataTypes.STRING, // Handle large numbers as strings
      allowNull: true, // Allow null for existing records
      defaultValue: '0',
      comment: 'Total amount paid out to participants (in token units)'
    },
    deploymentFee: {
      type: DataTypes.STRING, // Handle large numbers as strings
      allowNull: true, // Allow null for existing records
      defaultValue: '0',
      comment: 'Fee paid for contract deployment (in wei)'
    },
    authorizedBotAddress: {
      type: DataTypes.STRING,
      allowNull: true, // Allow null for existing records
      comment: 'Address of the bot authorized to record results for this quiz'
    }
  }, {
    sequelize,
    modelName: 'Quiz',
    tableName: 'quizzes',
    timestamps: true,
    indexes: [
      { fields: ['guildId'] }
    ]
  });
  
  return Quiz;
};
