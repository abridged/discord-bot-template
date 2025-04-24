# Discord Bot Template

A modern Discord bot template using discord.js, Next.js, and ngrok for local development. Built for IDE agent-centric development with Collab.Land Account Kit integration support.

## Step-by-Step Setup with IDE Agent Assistance

### 1. Configuring Your Local Environment

Ask your IDE agent to:

1. "Set up my environment variables"
   - The agent will help you copy `.env.example` to `.env`
   - This file will store your Discord credentials securely

### 2. Setting Up ngrok

Ask your IDE agent to:

1. "Help me set up ngrok for my Discord bot"
   - The agent will guide you to sign up at https://ngrok.com/
   - Help you obtain your authtoken
   - Add the token to your `.env` file in the `NGROK_AUTHTOKEN` field
   - For paid plans: Set up a reserved domain in the ngrok dashboard
   - Add your domain to the `NGROK_DOMAIN` field in your `.env` file
   - Start a tunnel with `npm run tunnel`
   - The tunnel command will automatically use your domain from the `.env` file
   - Keep the tunnel running for the next steps

### 3. Setting Up Your Discord Bot

Ask your IDE agent to help you:

1. "Create a new Discord application in the Discord Developer Portal"
   - Your agent will guide you to visit https://discord.com/developers/applications
   - Click "New Application" and enter a name for your bot
   - After creation, you'll be on the "General Information" page
   - Note your Application ID (Client ID) from this page
   - Add this Client ID to your `.env` file
   - Navigate to the "Bot" tab in the left sidebar
   - You should see your bot already created with its username
   - Under the username, click "Reset Token" to generate and view your bot token
   - Copy this token and immediately add it to your `.env` file (you won't be able to see it again)
   - Scroll down to "Privileged Gateway Intents" and enable all three options:
     * Presence Intent
     * Server Members Intent
     * Message Content Intent
   - Click "Save Changes" at the bottom

2. "Set up bot permissions and generate an invite link"
   - Your agent will help configure OAuth2 settings with proper scopes and permissions
   - In the OAuth2 section, navigate to the URL generator area
   - In the "Scopes" section, select `bot` and `applications.commands`
   - In the "Bot Permissions" section, select permissions including:
     * Under "Text Permissions":
       * `Send Messages` (to send messages)
       * `Read Message History` (to read messages)
     * Any other permissions your bot will need based on functionality
   - Use the generated URL to invite the bot to your test server
    - The bot will now be added to your server

2. "Install project dependencies"
   - The agent will run `npm install` for you

### 4. Running Your Bot

Ask your IDE agent to:

1. "Start my ngrok tunnel"
   - The agent will run `npm run tunnel` for you
   - Help you understand the ngrok interface and public URL
   - Note the generated URL (e.g., https://abc123.ngrok.io) - this changes each session on free tier
   - If using free tier, you'll get a random subdomain each time you restart ngrok
   - For consistent development, consider upgrading to a paid plan for reserved domains

2. "Deploy my Discord bot commands"
   - The agent will run `node src/bot/deploy-commands.js`
   - This registers your slash commands with Discord

3. "Start my Discord bot and web server"
   - The agent will help you run `npm run bot:dev` and `npm run dev` in separate terminals
   - Explain how to verify the bot is online

## Quick Start

Once you've completed the setup process above, use these commands to quickly start development in the future:

1. Create a tunnel: `npm run tunnel`
2. Deploy commands: `node src/bot/deploy-commands.js`
3. Start the bot: `npm run bot:dev`
4. Start the web interface: `npm run dev`

## Features

- Discord.js v14 integration
- Next.js web dashboard
- ngrok for secure tunneling
- Ready for Collab.Land Account Kit integration

## License

MIT
