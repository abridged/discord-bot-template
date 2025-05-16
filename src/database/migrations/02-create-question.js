'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('questions', {
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
      questionText: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      correctOptionIndex: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      options: {
        type: Sequelize.JSON,
        allowNull: false
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false
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
    
    // Add index for faster lookups
    await queryInterface.addIndex('questions', ['quizId']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('questions');
  }
};
