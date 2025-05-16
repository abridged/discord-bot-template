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
    }
  }, {
    sequelize,
    modelName: 'Quiz',
    tableName: 'quizzes',
    timestamps: true
  });
  
  return Quiz;
};
