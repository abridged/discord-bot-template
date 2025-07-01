const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Poll = sequelize.define('Poll', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      comment: 'Unique poll ID from Discord'
    },
    creatorId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID who created the poll'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Poll title/question'
    },
    options: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'JSON array of poll options',
      get() {
        const rawValue = this.getDataValue('options');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('options', JSON.stringify(value));
      }
    },
    tokenAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Token address associated with the poll'
    },
    chainId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Chain ID for the token'
    },
    fundingAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Funding amount for the poll'
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord server/guild ID'
    },
    channelId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord channel ID where poll was posted'
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord message ID containing the poll'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether the poll is still active'
    }
  });

  Poll.associate = function(models) {
    Poll.hasMany(models.PollVote, {
      foreignKey: 'pollId',
      as: 'votes',
      onDelete: 'CASCADE'
    });
  };

  return Poll;
};
