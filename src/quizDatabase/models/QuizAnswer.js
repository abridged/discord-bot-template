const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuizAnswer = sequelize.define('QuizAnswer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    completionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Reference to the quiz completion record'
    },
    questionIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Index of this question in the quiz (0-based)'
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'The question text'
    },
    selectedAnswer: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Answer chosen by the user'
    },
    correctAnswer: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'The correct answer to the question'
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the user answered correctly'
    }
  });

  QuizAnswer.associate = function(models) {
    QuizAnswer.belongsTo(models.QuizCompletion, {
      foreignKey: 'completionId',
      as: 'completion'
    });
  };

  return QuizAnswer;
};
