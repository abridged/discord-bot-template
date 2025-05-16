'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('answers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      quizId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'quizzes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      questionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'questions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      userDiscordId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      userWalletAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      selectedOptionIndex: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isCorrect: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      answeredAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      transactionHash: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    
    // Add indexes for faster lookups and to ensure a user can only answer a question once
    await queryInterface.addIndex('answers', ['quizId']);
    await queryInterface.addIndex('answers', ['questionId']);
    await queryInterface.addIndex('answers', ['userDiscordId']);
    await queryInterface.addIndex('answers', ['questionId', 'userDiscordId'], {
      unique: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('answers');
  }
};
