const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuizCompletion = sequelize.define('QuizCompletion', {
    guildId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord guild/server ID where the quiz was taken'
    },
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID who completed the quiz'
    },
    quizId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Identifier for the quiz (URL or quiz ID)'
    },
    userWalletAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Wallet address of the user who completed the quiz'
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Score achieved on this quiz'
    },
    totalQuestions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total number of questions in this quiz'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the quiz was completed'
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['userId', 'quizId'],
        name: 'unique_user_quiz_completion'
      },
      { fields: ['guildId'] }
    ]
  });

  QuizCompletion.associate = function(models) {
    QuizCompletion.hasMany(models.QuizAnswer, {
      foreignKey: 'completionId',
      as: 'answers'
    });
  };

  return QuizCompletion;
};
