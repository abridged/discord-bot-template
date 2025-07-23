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

    // Add new fields to Quiz table for contract integration
    // IMPORTANT: Keep all existing fields to prevent regressions
    
    console.log('Adding contract integration fields to Quiz table...');
    
    // Add bot recording status tracking if it doesn't exist
    if (!(await columnExists('quizzes', 'botRecordingStatus'))) {
      await queryInterface.addColumn('quizzes', 'botRecordingStatus', {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        allowNull: true, // Allow null for existing records
        defaultValue: null,
        comment: 'Status of bot recording quiz results on-chain'
      });
    }
    
    // Add participant count tracking if it doesn't exist
    if (!(await columnExists('quizzes', 'participantCount'))) {
      await queryInterface.addColumn('quizzes', 'participantCount', {
        type: Sequelize.INTEGER,
        allowNull: true, // Allow null for existing records
        defaultValue: 0,
        comment: 'Number of participants who completed the quiz'
      });
    }
    
    // Add total payout tracking if it doesn't exist
    if (!(await columnExists('quizzes', 'totalPaidOut'))) {
      await queryInterface.addColumn('quizzes', 'totalPaidOut', {
        type: Sequelize.STRING, // Handle large numbers as strings
        allowNull: true, // Allow null for existing records
        defaultValue: '0',
        comment: 'Total amount paid out to participants (in token units)'
      });
    }
    
    // Add contract deployment fee tracking if it doesn't exist
    if (!(await columnExists('quizzes', 'deploymentFee'))) {
      await queryInterface.addColumn('quizzes', 'deploymentFee', {
        type: Sequelize.STRING, // Handle large numbers as strings
        allowNull: true, // Allow null for existing records
        defaultValue: '0',
        comment: 'Fee paid for contract deployment (in wei)'
      });
    }
    
    // Add authorizedBot address tracking if it doesn't exist
    if (!(await columnExists('quizzes', 'authorizedBotAddress'))) {
      await queryInterface.addColumn('quizzes', 'authorizedBotAddress', {
        type: Sequelize.STRING,
        allowNull: true, // Allow null for existing records
        comment: 'Address of the bot authorized to record results for this quiz'
      });
    }

    console.log('Contract integration fields added successfully to Quiz table');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing contract integration fields from Quiz table...');
    
    // Remove the added columns in reverse order
    await queryInterface.removeColumn('quizzes', 'authorizedBotAddress');
    await queryInterface.removeColumn('quizzes', 'deploymentFee');
    await queryInterface.removeColumn('quizzes', 'totalPaidOut');
    await queryInterface.removeColumn('quizzes', 'participantCount');
    await queryInterface.removeColumn('quizzes', 'botRecordingStatus');

    console.log('Contract integration fields removed from Quiz table');
  }
};
