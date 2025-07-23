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

    // Add escrowAddress if it doesn't exist
    if (!(await columnExists('quizzes', 'escrowAddress'))) {
      await queryInterface.addColumn('quizzes', 'escrowAddress', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Ethereum address of the deployed quiz escrow contract'
      });
    }
    
    // Add transactionHash if it doesn't exist
    if (!(await columnExists('quizzes', 'transactionHash'))) {
      await queryInterface.addColumn('quizzes', 'transactionHash', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Transaction hash of the escrow contract deployment'
      });
    }
    
    // Add onChain if it doesn't exist
    if (!(await columnExists('quizzes', 'onChain'))) {
      await queryInterface.addColumn('quizzes', 'onChain', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the quiz has been deployed on-chain'
      });
    }
    
    // Add expiryTime if it doesn't exist
    if (!(await columnExists('quizzes', 'expiryTime'))) {
      await queryInterface.addColumn('quizzes', 'expiryTime', {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Unix timestamp when the quiz expires on-chain'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quizzes', 'escrowAddress');
    await queryInterface.removeColumn('quizzes', 'transactionHash');
    await queryInterface.removeColumn('quizzes', 'onChain');
    await queryInterface.removeColumn('quizzes', 'expiryTime');
  }
};
