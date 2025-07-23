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

    // Add onChain if it doesn't exist
    if (!(await columnExists('answers', 'onChain'))) {
      await queryInterface.addColumn('answers', 'onChain', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the answer has been recorded on-chain'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('answers', 'onChain');
  }
};
