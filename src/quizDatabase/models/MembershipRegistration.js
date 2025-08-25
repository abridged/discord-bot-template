module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const MembershipRegistration = sequelize.define('MembershipRegistration', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    subjectDid: { type: DataTypes.STRING, allowNull: false },
    guildId: { type: DataTypes.STRING, allowNull: false },
    membershipKey: { type: DataTypes.STRING, allowNull: false, unique: true },
    attestedAt: { type: DataTypes.DATE, allowNull: false },
    txHash: { type: DataTypes.STRING(66), allowNull: true },
    verifyOnChainAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'membership_registrations',
    indexes: [
      { unique: true, fields: ['membershipKey'] },
      { fields: ['subjectDid'] },
      { fields: ['guildId'] }
    ]
  });
  return MembershipRegistration;
};


