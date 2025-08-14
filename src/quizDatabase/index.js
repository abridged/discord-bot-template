const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Create the db directory if it doesn't exist
const dbDir = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Use the main PostgreSQL database for quiz tracking
const config = require('../database/config/config.js');
const env = process.env.NODE_ENV || 'development';
let quizDbConfig = config[env];

// Handle DATABASE_URL for any environment that has it
if (process.env.DATABASE_URL) {
  quizDbConfig = process.env.DATABASE_URL;
}

// Create Sequelize instance for quiz tracking using PostgreSQL
const quizSequelize = new Sequelize(quizDbConfig);

// Initialize quiz database connection
const initializeQuizDatabase = async () => {
  try {
    await quizSequelize.authenticate();
    console.log('Quiz tracking database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the quiz tracking database:', error);
    return false;
  }
};

// Setup models
const setupModels = async () => {
  const db = {};
  
  // Manually require each model (since we don't have many)
  const QuizCompletion = require('./models/QuizCompletion')(quizSequelize);
  const QuizAnswer = require('./models/QuizAnswer')(quizSequelize);
  const QuizAttempt = require('./models/QuizAttempt')(quizSequelize);
  
  db.QuizCompletion = QuizCompletion;
  db.QuizAnswer = QuizAnswer;
  db.QuizAttempt = QuizAttempt;
  
  // Set up associations
  if (QuizCompletion.associate) {
    QuizCompletion.associate(db);
  }
  
  if (QuizAnswer.associate) {
    QuizAnswer.associate(db);
  }
  
  if (QuizAttempt.associate) {
    QuizAttempt.associate(db);
  }

  db.sequelize = quizSequelize;
  db.Sequelize = Sequelize;
  
  // Sync the database (create tables if they don't exist)
  try {
    await quizSequelize.sync({ alter: true });
    console.log('Quiz tracking database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing quiz tracking database:', error);
  }
  
  return db;
};

module.exports = {
  quizSequelize,
  initializeQuizDatabase,
  setupModels,
  Sequelize
};
