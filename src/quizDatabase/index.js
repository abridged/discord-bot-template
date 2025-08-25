require('../database/pg-ssl');
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

// Prefer QUIZ_DATABASE_URL, then DATABASE_URL (Heroku/Supabase)
const connectionUrl = process.env.QUIZ_DATABASE_URL || process.env.DATABASE_URL || '';
const useUrl = !!connectionUrl;

// Create Sequelize instance for quiz tracking using PostgreSQL
const quizSequelize = useUrl
  ? new Sequelize(connectionUrl, {
      dialect: 'postgres',
      protocol: 'postgres',
      ssl: true,
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      },
      logging: false
    })
  : new Sequelize(quizDbConfig);

// Initialize quiz database connection
const initializeQuizDatabase = async () => {
  try {
    await quizSequelize.authenticate();
    console.log('[QuizDB] Connected:', useUrl ? 'URL' : `${quizDbConfig.host}/${quizDbConfig.database}`);
    return true;
  } catch (error) {
    console.error('[QuizDB] Unable to connect:', error.message);
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
  const MembershipRegistration = require('./models/MembershipRegistration')(quizSequelize);
  
  db.QuizCompletion = QuizCompletion;
  db.QuizAnswer = QuizAnswer;
  db.QuizAttempt = QuizAttempt;
  db.MembershipRegistration = MembershipRegistration;
  
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
    console.log('[QuizDB] Synchronized');
  } catch (error) {
    console.error('[QuizDB] Sync error:', error.message);
  }
  
  return db;
};

module.exports = {
  quizSequelize,
  initializeQuizDatabase,
  setupModels,
  Sequelize
};
