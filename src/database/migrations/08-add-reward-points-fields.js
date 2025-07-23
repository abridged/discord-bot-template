'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        return tableDescription.hasOwnProperty(columnName);
      } catch (error) {
        return false;
      }
    };

    // Add correctRewardPoints if it doesn't exist
    if (!(await columnExists('quizzes', 'correctRewardPoints'))) {
      await queryInterface.addColumn('quizzes', 'correctRewardPoints', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 75,
        comment: 'Points awarded for correct answers'
      });
    }
    
    // Add incorrectRewardPoints if it doesn't exist
    if (!(await columnExists('quizzes', 'incorrectRewardPoints'))) {
      await queryInterface.addColumn('quizzes', 'incorrectRewardPoints', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 25,
        comment: 'Points awarded for incorrect answers'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quizzes', 'correctRewardPoints');
    await queryInterface.removeColumn('quizzes', 'incorrectRewardPoints');
  }
}; 