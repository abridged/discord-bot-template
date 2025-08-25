/**
 * Intuition ID utilities
 * - subject DID: did:eip155:<chainId>:<addressLower>
 * - community ID: discord:<guildId>
 * - membership key: <subjectDid>|<communityId>
 */

function ensureHexAddressLowercase(address) {
  if (typeof address !== 'string') throw new Error('address must be a string');
  const addr = address.startsWith('0x') ? address : `0x${address}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error(`invalid EVM address: ${address}`);
  }
  return addr.toLowerCase();
}

function buildSubjectDid(chainId, address) {
  if (!chainId) throw new Error('chainId is required');
  const chainIdNum = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  if (!Number.isFinite(chainIdNum)) throw new Error('chainId must be a number');
  const addr = ensureHexAddressLowercase(address);
  return `did:eip155:${chainIdNum}:${addr}`;
}

function buildCommunityId(guildId) {
  if (!guildId) throw new Error('guildId is required');
  return `discord:${String(guildId)}`;
}

function buildMembershipKey(subjectDid, communityId) {
  if (!subjectDid || !communityId) throw new Error('subjectDid and communityId are required');
  return `${subjectDid}|${communityId}`;
}

module.exports = {
  ensureHexAddressLowercase,
  buildSubjectDid,
  buildCommunityId,
  buildMembershipKey
};


