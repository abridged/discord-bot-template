const { publicClient, walletClient, account, chainId, rpcUrl } = require('../services/intuition/setup');

async function main() {
  console.log('[Intuition] Ping start');
  console.log('[Intuition] chainId:', chainId);
  console.log('[Intuition] rpcUrl:', rpcUrl);
  console.log('[Intuition] has wallet:', Boolean(walletClient && account));

  try {
    const bn = await publicClient.getBlockNumber();
    console.log('[Intuition] latest block number:', bn.toString());
  } catch (e) {
    console.error('[Intuition] public client error:', e.message);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[Intuition] ping failed:', e);
  process.exit(1);
});


