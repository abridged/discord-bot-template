const { buildSubjectDid, buildCommunityId, buildMembershipKey } = require('../services/intuition/ids');

const chainId = process.env.DEMO_CHAIN_ID || '84532';
const addr = process.env.DEMO_ADDRESS || '0x114c07fd124d5C18C157E21Ca25773271B1149b5';
const guildId = process.env.DEMO_GUILD_ID || '123456789012345678';

const subjectDid = buildSubjectDid(chainId, addr);
const communityId = buildCommunityId(guildId);
const membershipKey = buildMembershipKey(subjectDid, communityId);

console.log('subjectDid =', subjectDid);
console.log('communityId =', communityId);
console.log('membershipKey =', membershipKey);


