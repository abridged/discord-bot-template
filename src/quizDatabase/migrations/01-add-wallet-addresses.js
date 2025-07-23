'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add userWalletAddress to QuizAttempts table
    await queryInterface.addColumn('QuizAttempts', 'userWalletAddress', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Wallet address of the user taking the quiz'
    });

    // Add userWalletAddress to QuizCompletions table
    await queryInterface.addColumn('QuizCompletions', 'userWalletAddress', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Wallet address of the user who completed the quiz'
    });

    console.log('✅ Added userWalletAddress columns to QuizAttempts and QuizCompletions tables');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove userWalletAddress from QuizAttempts table
    await queryInterface.removeColumn('QuizAttempts', 'userWalletAddress');

    // Remove userWalletAddress from QuizCompletions table
    await queryInterface.removeColumn('QuizCompletions', 'userWalletAddress');

    console.log('✅ Removed userWalletAddress columns from QuizAttempts and QuizCompletions tables');
  }
}; 