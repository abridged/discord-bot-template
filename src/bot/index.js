require("dotenv").config();
const { Client, GatewayIntentBits, Events, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { initializeDatabase } = require("../database");
const { initializeQuizDatabase, setupModels } = require("../quizDatabase");
const { initializePollTracking } = require("../pollDatabase/setup");
const { pollManager } = require("../pollDatabase");
const { initialize: initializeStorage } = require("../services/storage");
const {
  initializeWalletMappingService,
} = require("../services/walletMappingService");

// Create a logger for command registration
const logCommandRegistration = (commandName, commandData) => {
  try {
    console.log(`Registering command: /${commandName}`);
  } catch (error) {
    console.error(
      `Error logging command registration for ${commandName}:`,
      error
    );
  }
};

// Create a new client instance
const baseIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
const enableMessageContent = (process.env.DISCORD_ENABLE_MESSAGE_CONTENT || 'true') === 'true';
if (enableMessageContent) {
  baseIntents.push(GatewayIntentBits.MessageContent);
}
const client = new Client({ intents: baseIntents });

// Command collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

// Load each command file
for (const file of commandFiles) {
  try {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Validate command structure
    if ("data" in command && "execute" in command) {
      // Register the command
      const commandName = command.data.name;
      client.commands.set(commandName, command);

      // Log successful registration
      logCommandRegistration(commandName, command.data);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  } catch (error) {
    console.error(`[ERROR] Failed to load command from ${file}:`, error);
  }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Initialize database and storage services
Promise.all([
  initializeStorage(),
  initializeQuizDatabase(),
  initializePollTracking(),
  initializeWalletMappingService(),
])
  .then(
    async ([
      storageSuccess,
      quizDbSuccess,
      pollDbSuccess,
      walletMappingSuccess,
    ]) => {
      if (storageSuccess) {
        console.log("Storage service initialized successfully");
      } else {
        console.warn(
          "Storage service initialization failed, some features may not work correctly"
        );
      }

      if (quizDbSuccess) {
        console.log("Quiz database connection successful");
        // Setup quiz database models and make them available to the client
        client.quizDb = await setupModels();
        console.log("Quiz tracking system initialized");
      } else {
        console.warn(
          "Quiz database initialization failed, quiz tracking features will use in-memory storage"
        );
        // Fallback to in-memory storage if database fails
        client.completedQuizzes = new Map();
      }

      if (pollDbSuccess) {
        console.log("Poll database connection successful");
        // Make poll manager available to the client
        client.pollManager = pollManager;
        console.log("Poll tracking system initialized");
      } else {
        console.warn(
          "Poll database initialization failed, poll features will use in-memory storage"
        );
        // Fallback to in-memory storage if database fails
        global.pendingPolls = new Map();
        global.pollVotes = new Map();
      }

      // Create a map for pending quizzes if it doesn't exist
      global.pendingQuizzes = global.pendingQuizzes || new Map();

      // Log in to Discord with your client's token
      client.login(process.env.DISCORD_TOKEN);
    }
  )
  .catch((error) => {
    console.error("Failed to initialize services:", error);

    // Still attempt to log in to Discord so the bot can function
    client.login(process.env.DISCORD_TOKEN);
  });
