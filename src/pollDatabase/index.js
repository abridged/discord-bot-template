const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Create the db directory if it doesn't exist
const dbDir = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Use the main PostgreSQL database for poll tracking
const config = require('../database/config/config.js');
const env = process.env.NODE_ENV || 'development';
let pollDbConfig = config[env];

// Prefer DATABASE_URL when available (Heroku/Supabase)
const useUrl = !!process.env.DATABASE_URL;

// Create Sequelize instance for poll tracking using PostgreSQL
const pollSequelize = useUrl
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      },
      logging: false
    })
  : new Sequelize(pollDbConfig);

// Initialize poll database connection
const initializePollDatabase = async () => {
  try {
    await pollSequelize.authenticate();
    console.log('Poll tracking database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the poll tracking database:', error);
    return false;
  }
};

// Setup models - create a persistent models reference
let models = null;

const setupModels = async () => {
  // If models are already set up, just return them
  if (models !== null) {
    return models;
  }
  
  const db = {};
  
  // Manually require each model
  const Poll = require('./models/Poll')(pollSequelize);
  const PollVote = require('./models/PollVote')(pollSequelize);
  
  db.Poll = Poll;
  db.PollVote = PollVote;
  
  // Set up associations
  if (Poll.associate) {
    Poll.associate(db);
  }
  
  if (PollVote.associate) {
    PollVote.associate(db);
  }

  db.sequelize = pollSequelize;
  db.Sequelize = Sequelize;
  
  // Sync the database (create tables if they don't exist)
  try {
    await pollSequelize.sync();
    console.log('Poll tracking database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing poll tracking database:', error);
  }
  
  // Store the models for reuse
  models = db;
  return db;
};

// Helper methods for polls
const pollManager = {
  async savePoll(pollData) {
    const { Poll } = await setupModels();
    return Poll.create(pollData);
  },
  
  async getPoll(pollId) {
    const { Poll } = await setupModels();
    return Poll.findByPk(pollId);
  },
  
  async recordVote(pollId, userId, optionIndex) {
    const { PollVote, Poll } = await setupModels();
    
    // Check if user has already voted
    const existingVote = await PollVote.findOne({
      where: { pollId, userId }
    });
    
    if (existingVote) {
      return { success: false, message: 'You have already voted in this poll.' };
    }
    
    // Create the vote
    await PollVote.create({
      pollId,
      userId,
      optionIndex
    });
    
    return { success: true, message: 'Your vote has been recorded.' };
  },
  
  async getPollVotes(pollId) {
    const { Poll, PollVote } = await setupModels();
    
    // Get the poll
    const poll = await Poll.findByPk(pollId);
    if (!poll) return null;
    
    // Get the votes
    const votes = await PollVote.findAll({
      where: { pollId }
    });
    
    // Count votes per option
    const options = poll.options;
    const optionVotes = new Array(options.length).fill(0);
    const voters = new Map();
    
    votes.forEach(vote => {
      const optionIdx = vote.optionIndex;
      if (optionIdx >= 0 && optionIdx < optionVotes.length) {
        optionVotes[optionIdx]++;
        voters.set(vote.userId, optionIdx);
      }
    });
    
    return {
      options: optionVotes,
      voters
    };
  },
  
  async getAllActivePolls() {
    const { Poll } = await setupModels();
    return Poll.findAll({
      where: { isActive: true }
    });
  }
};

module.exports = {
  pollSequelize,
  initializePollDatabase,
  setupModels,
  pollManager,
  Sequelize
};
