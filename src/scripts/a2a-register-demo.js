const axios = require('axios');

async function main() {
  const base = process.env.A2A_PUBLIC_BASE_URL || `http://localhost:${process.env.A2A_PORT || 41241}`;
  const smartAccountAddress = process.env.DEMO_ADDRESS || '0x114c07fd124d5C18C157E21Ca25773271B1149b5';
  const chainId = Number(process.env.DEMO_CHAIN_ID || 84532);
  const guildId = process.env.DEMO_GUILD_ID || '123456789012345678';
  const completedAt = new Date().toISOString();

  const req = {
    jsonrpc: '2.0',
    id: '1',
    method: 'message/send',
    params: {
      message: {
        messageId: `m-${Date.now()}`,
        parts: [
          { kind: 'text', text: JSON.stringify({ skillId: 'register_community_member', smartAccountAddress, chainId, guildId, completedAt }) }
        ]
      },
      configuration: { blocking: true }
    }
  };

  const { data } = await axios.post(`${base}/`, req, { headers: { 'content-type': 'application/json' } });
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


