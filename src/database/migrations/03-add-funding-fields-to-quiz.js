'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('quizzes', 'fundingStatus', {
      type: Sequelize.ENUM('unfunded', 'pending', 'funded', 'distributing', 'distributed'),
      defaultValue: 'unfunded',
      allowNull: false
    });

    await queryInterface.addColumn('quizzes', 'treasuryWalletAddress', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('quizzes', 'fundingTransactionHash', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('quizzes', 'distributionTransactionHash', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('quizzes', 'distributedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quizzes', 'fundingStatus');
    await queryInterface.removeColumn('quizzes', 'treasuryWalletAddress');
    await queryInterface.removeColumn('quizzes', 'fundingTransactionHash');
    await queryInterface.removeColumn('quizzes', 'distributionTransactionHash');
    await queryInterface.removeColumn('quizzes', 'distributedAt');
  }
};
