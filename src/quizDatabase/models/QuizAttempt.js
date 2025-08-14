/**
 * Quiz Attempt model
 * Tracks all quiz attempts by users, even if they didn't complete the quiz
 */

module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  
  const QuizAttempt = sequelize.define('QuizAttempt', {
    guildId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord guild/server ID where the quiz was attempted'
    },
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID'
    },
    quizId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Unique quiz ID'
    },
    userWalletAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Wallet address of the user taking the quiz'
    },
    attemptedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the user started the quiz'
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the quiz was completed or abandoned'
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['userId', 'quizId'],
        name: 'unique_user_quiz'
      },
      { fields: ['guildId'] }
    ],
    comment: 'Tracks quiz attempts by users'
  });

  QuizAttempt.associate = function(models) {
    // Define associations if needed in the future
  };

  return QuizAttempt;
};
