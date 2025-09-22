#!/usr/bin/env node
require('dotenv').config();

async function main() {
  const [, , userIdArg] = process.argv;
  const userId = userIdArg || process.env.DISCORD_USER_ID;

  if (!userId) {
    console.error('Usage: npm run user:address -- <discordUserId>\n       or: DISCORD_USER_ID=<id> npm run user:address');
    process.exit(1);
  }

  try {
    const { getUserWallet } = require('../src/account-kit/sdk');
    const addr = await getUserWallet(userId);
    if (!addr) {
      console.error('No smart account found for user:', userId);
      process.exit(2);
    }
    console.log(addr);
  } catch (err) {
    console.error(err?.message || String(err));
    process.exit(1);
  }
}

main();


