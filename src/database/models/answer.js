const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Answer extends Model {
    static associate(models) {
      // define associations here
      Answer.belongsTo(models.Quiz, {
        foreignKey: 'quizId',
        as: 'quiz'
      });
      
      Answer.belongsTo(models.Question, {
        foreignKey: 'questionId',
        as: 'question'
      });
    }
  }
  
  Answer.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'quizzes',
        key: 'id'
      }
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    userDiscordId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userWalletAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    selectedOptionIndex: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    answeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    transactionHash: {
      type: DataTypes.STRING,
      allowNull: true // For blockchain tx
    },
    onChain: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the answer has been recorded on-chain'
    },
    // ============ CONTRACT INTEGRATION FIELDS ============
    // Added for new contract architecture compatibility
    correctAnswersCount: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for existing records
      defaultValue: null,
      comment: 'Number of correct answers by this participant (for contract recording)'
    },
    incorrectAnswersCount: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for existing records
      defaultValue: null,
      comment: 'Number of incorrect answers by this participant (for contract recording)'
    },
    payoutAmount: {
      type: DataTypes.STRING, // Handle large numbers as strings
      allowNull: true, // Allow null for existing records
      defaultValue: null,
      comment: 'Amount paid out to this participant (in token units)'
    },
    botRecordingTxHash: {
      type: DataTypes.STRING,
      allowNull: true, // Allow null for existing records
      comment: 'Transaction hash of bot recording results via recordQuizResult()'
    },
    recordedViaContract: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this result was recorded via new contract recordQuizResult method'
    }
  }, {
    sequelize,
    modelName: 'Answer',
    tableName: 'answers',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['questionId', 'userDiscordId']
      }
    ]
  });
  
  return Answer;
};
