'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('answers', 'onChain', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the answer has been recorded on-chain'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('answers', 'onChain');
  }
};
