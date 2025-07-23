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
    if (!(await tableExists('answers'))) {
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
    }
    
    // Add indexes only if they don't exist
    if (!(await indexExists('answers', 'answers_quiz_id'))) {
      await queryInterface.addIndex('answers', ['quizId']);
    }
    
    if (!(await indexExists('answers', 'answers_question_id'))) {
      await queryInterface.addIndex('answers', ['questionId']);
    }
    
    if (!(await indexExists('answers', 'answers_user_discord_id'))) {
      await queryInterface.addIndex('answers', ['userDiscordId']);
    }
    
    if (!(await indexExists('answers', 'answers_question_id_user_discord_id'))) {
      await queryInterface.addIndex('answers', ['questionId', 'userDiscordId'], {
        unique: true
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('answers');
  }
};
