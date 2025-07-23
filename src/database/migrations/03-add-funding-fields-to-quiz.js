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

    // Add fundingStatus if it doesn't exist
    if (!(await columnExists('quizzes', 'fundingStatus'))) {
      await queryInterface.addColumn('quizzes', 'fundingStatus', {
        type: Sequelize.ENUM('unfunded', 'pending', 'funded', 'distributing', 'distributed'),
        defaultValue: 'unfunded',
        allowNull: false
      });
    }

    // Add treasuryWalletAddress if it doesn't exist
    if (!(await columnExists('quizzes', 'treasuryWalletAddress'))) {
      await queryInterface.addColumn('quizzes', 'treasuryWalletAddress', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add fundingTransactionHash if it doesn't exist
    if (!(await columnExists('quizzes', 'fundingTransactionHash'))) {
      await queryInterface.addColumn('quizzes', 'fundingTransactionHash', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add distributionTransactionHash if it doesn't exist
    if (!(await columnExists('quizzes', 'distributionTransactionHash'))) {
      await queryInterface.addColumn('quizzes', 'distributionTransactionHash', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add distributedAt if it doesn't exist
    if (!(await columnExists('quizzes', 'distributedAt'))) {
      await queryInterface.addColumn('quizzes', 'distributedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quizzes', 'fundingStatus');
    await queryInterface.removeColumn('quizzes', 'treasuryWalletAddress');
    await queryInterface.removeColumn('quizzes', 'fundingTransactionHash');
    await queryInterface.removeColumn('quizzes', 'distributionTransactionHash');
    await queryInterface.removeColumn('quizzes', 'distributedAt');
  }
};
