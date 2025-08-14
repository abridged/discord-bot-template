'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // quizzes.guildId
    try {
      await queryInterface.addColumn('quizzes', 'guildId', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Discord guild/server ID this quiz belongs to'
      });
      await queryInterface.addIndex('quizzes', ['guildId']);
    } catch (e) {
      console.warn('Skipping quizzes.guildId add (maybe exists):', e.message);
    }

    // questions.guildId
    try {
      await queryInterface.addColumn('questions', 'guildId', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Discord guild/server ID for multi-tenant segregation'
      });
      await queryInterface.addIndex('questions', ['guildId']);
    } catch (e) {
      console.warn('Skipping questions.guildId add (maybe exists):', e.message);
    }

    // answers.guildId
    try {
      await queryInterface.addColumn('answers', 'guildId', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Discord guild/server ID for multi-tenant segregation'
      });
      await queryInterface.addIndex('answers', ['guildId']);
    } catch (e) {
      console.warn('Skipping answers.guildId add (maybe exists):', e.message);
    }
  },

  down: async (queryInterface) => {
    try { await queryInterface.removeIndex('answers', ['guildId']); } catch (e) {}
    try { await queryInterface.removeColumn('answers', 'guildId'); } catch (e) {}

    try { await queryInterface.removeIndex('questions', ['guildId']); } catch (e) {}
    try { await queryInterface.removeColumn('questions', 'guildId'); } catch (e) {}

    try { await queryInterface.removeIndex('quizzes', ['guildId']); } catch (e) {}
    try { await queryInterface.removeColumn('quizzes', 'guildId'); } catch (e) {}
  }
};
