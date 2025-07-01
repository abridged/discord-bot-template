const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PollVote = sequelize.define('PollVote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    pollId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Reference to the poll'
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID who voted'
    },
    optionIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Index of the selected option (0-based)'
    },
    votedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the vote was cast'
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['pollId', 'userId'],
        name: 'unique_poll_user_vote'
      }
    ]
  });

  PollVote.associate = function(models) {
    PollVote.belongsTo(models.Poll, {
      foreignKey: 'pollId',
      as: 'poll'
    });
  };

  return PollVote;
};
