/**
 * Wallet Mapping Model
 * 
 * Stores mappings between Discord user IDs and their corresponding wallet addresses.
 * Used for caching wallet addresses to minimize Account Kit SDK calls.
 */

'use strict';

module.exports = (sequelize, DataTypes) => {
  const WalletMapping = sequelize.define('WalletMapping', {
    // Discord user ID as primary key
    discordId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      comment: 'Discord user ID'
    },
    
    // Smart account/wallet address
    walletAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Smart account wallet address'
    },
    
    // Optional platform field (github, discord, etc.)
    platform: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'discord',
      comment: 'Platform associated with this wallet (github, discord, etc.)'
    },
    
    // Last updated timestamp
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp of when this mapping was last updated'
    }
  }, {
    tableName: 'wallet_mappings',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['discordId']
      },
      {
        unique: false,
        fields: ['walletAddress']
      }
    ]
  });

  return WalletMapping;
};
