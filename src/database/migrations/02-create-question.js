'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if table exists
    const tableExists = async (tableName) => {
      try {
        await queryInterface.describeTable(tableName);
        return true;
      } catch (error) {
        return false;
      }
    };

    // Helper function to check if index exists
    const indexExists = async (tableName, indexName) => {
      try {
        const indexes = await queryInterface.showIndex(tableName);
        return indexes.some(index => index.name === indexName);
      } catch (error) {
        return false;
      }
    };

    // Only create table if it doesn't exist
    if (!(await tableExists('questions'))) {
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
    }
    
    // Add index only if it doesn't exist
    if (!(await indexExists('questions', 'questions_quiz_id'))) {
      await queryInterface.addIndex('questions', ['quizId']);
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('questions');
  }
};
