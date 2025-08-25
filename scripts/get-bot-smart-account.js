require('dotenv').config();

(async () => {
  try {
    const { getBotWallet } = require('../src/account-kit/sdk');
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      console.error('DISCORD_CLIENT_ID is not set in the environment.');
      process.exit(1);
    }
    const address = await getBotWallet();
    console.log(address);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();


