'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('quizzes', 'escrowAddress', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Ethereum address of the deployed quiz escrow contract'
    });
    
    await queryInterface.addColumn('quizzes', 'transactionHash', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Transaction hash of the escrow contract deployment'
    });
    
    await queryInterface.addColumn('quizzes', 'onChain', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the quiz has been deployed on-chain'
    });
    
    await queryInterface.addColumn('quizzes', 'expiryTime', {
      type: Sequelize.BIGINT,
      allowNull: true,
      comment: 'Unix timestamp when the quiz expires on-chain'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quizzes', 'escrowAddress');
    await queryInterface.removeColumn('quizzes', 'transactionHash');
    await queryInterface.removeColumn('quizzes', 'onChain');
    await queryInterface.removeColumn('quizzes', 'expiryTime');
  }
};
