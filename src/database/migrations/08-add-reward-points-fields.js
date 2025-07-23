'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('quizzes', 'correctRewardPoints', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 75,
      comment: 'Points awarded for correct answers'
    });
    
    await queryInterface.addColumn('quizzes', 'incorrectRewardPoints', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 25,
      comment: 'Points awarded for incorrect answers'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quizzes', 'correctRewardPoints');
    await queryInterface.removeColumn('quizzes', 'incorrectRewardPoints');
  }
}; 