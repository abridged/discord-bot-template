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
      allowNull: true // For future blockchain tx
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
