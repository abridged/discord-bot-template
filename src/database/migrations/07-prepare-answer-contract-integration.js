'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        return tableDescription.hasOwnProperty(columnName);
      } catch (error) {
        return false;
      }
    };

    // Add new fields to Answer table for contract integration
    // IMPORTANT: Keep all existing fields to prevent regressions
    
    console.log('Adding contract integration fields to Answer table...');
    
    // Add result counts for contract recording if they don't exist
    if (!(await columnExists('answers', 'correctAnswersCount'))) {
      await queryInterface.addColumn('answers', 'correctAnswersCount', {
        type: Sequelize.INTEGER,
        allowNull: true, // Allow null for existing records
        defaultValue: null,
        comment: 'Number of correct answers by this participant (for contract recording)'
      });
    }
    
    if (!(await columnExists('answers', 'incorrectAnswersCount'))) {
      await queryInterface.addColumn('answers', 'incorrectAnswersCount', {
        type: Sequelize.INTEGER,
        allowNull: true, // Allow null for existing records
        defaultValue: null,
        comment: 'Number of incorrect answers by this participant (for contract recording)'
      });
    }
    
    // Add payout amount tracking if it doesn't exist
    if (!(await columnExists('answers', 'payoutAmount'))) {
      await queryInterface.addColumn('answers', 'payoutAmount', {
        type: Sequelize.STRING, // Handle large numbers as strings
        allowNull: true, // Allow null for existing records
        defaultValue: null,
        comment: 'Amount paid out to this participant (in token units)'
      });
    }
    
    // Add bot recording transaction hash if it doesn't exist
    if (!(await columnExists('answers', 'botRecordingTxHash'))) {
      await queryInterface.addColumn('answers', 'botRecordingTxHash', {
        type: Sequelize.STRING,
        allowNull: true, // Allow null for existing records
        comment: 'Transaction hash of bot recording results via recordQuizResult()'
      });
    }
    
    // Add flag to indicate if recorded via new contract method if it doesn't exist
    if (!(await columnExists('answers', 'recordedViaContract'))) {
      await queryInterface.addColumn('answers', 'recordedViaContract', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this result was recorded via new contract recordQuizResult method'
      });
    }

    console.log('Contract integration fields added successfully to Answer table');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing contract integration fields from Answer table...');
    
    // Remove the added columns in reverse order
    await queryInterface.removeColumn('answers', 'recordedViaContract');
    await queryInterface.removeColumn('answers', 'botRecordingTxHash');
    await queryInterface.removeColumn('answers', 'payoutAmount');
    await queryInterface.removeColumn('answers', 'incorrectAnswersCount');
    await queryInterface.removeColumn('answers', 'correctAnswersCount');

    console.log('Contract integration fields removed from Answer table');
  }
};
