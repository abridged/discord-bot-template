'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quizzes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      creatorDiscordId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      creatorWalletAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      sourceUrl: {
        type: Sequelize.STRING,
        allowNull: false
      },
      difficulty: {
        type: Sequelize.STRING,
        allowNull: false
      },
      questionCount: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      tokenAddress: {
        type: Sequelize.STRING,
        allowNull: false
      },
      chainId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      rewardAmount: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      quizHash: {
        type: Sequelize.STRING,
        allowNull: true
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('quizzes');
  }
};
