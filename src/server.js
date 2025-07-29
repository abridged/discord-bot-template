const express = require('express');
const path = require('path');
const cors = require('cors');
const csv = require('fast-csv');
require('dotenv').config();

// Import database models
const db = require('./database/index');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'Discord Bot Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API status endpoint (replacing the Next.js API route)
app.get('/api/status', (req, res) => {
  res.json({ 
    name: 'Discord Bot API', 
    status: 'online',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// CSV Export endpoint
app.get('/api/export/csv', async (req, res) => {
  try {
    const { table = 'all', format = 'combined' } = req.query;
    
    // Set CSV headers
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `database-export-${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (table === 'all' || format === 'combined') {
      // Export all data in a comprehensive format
      await exportCombinedData(res);
    } else {
      // Export specific table
      await exportTableData(table, res);
    }
  } catch (error) {
    console.error('CSV Export Error:', error);
    res.status(500).json({ 
      error: 'Export failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Unable to export data'
    });
  }
});

// Function to export combined data with relationships
async function exportCombinedData(res) {
  const csvStream = csv.format({ headers: true });
  csvStream.pipe(res);
  
  try {
    // Get all quizzes with questions and answers
    const quizzes = await db.Quiz.findAll({
      include: [
        {
          model: db.Question,
          as: 'questions',
          include: [{
            model: db.Answer,
            as: 'answers'
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Write header row
    csvStream.write({
      'Quiz ID': 'Quiz ID',
      'Quiz Title': 'Quiz Title', 
      'Creator Discord ID': 'Creator Discord ID',
      'Quiz Created': 'Quiz Created',
      'Question ID': 'Question ID',
      'Question Text': 'Question Text',
      'Question Type': 'Question Type',
      'Answer ID': 'Answer ID',
      'Answer Text': 'Answer Text',
      'Is Correct': 'Is Correct',
      'User Discord ID': 'User Discord ID',
      'Answer Created': 'Answer Created'
    });
    
    // Process each quiz
    for (const quiz of quizzes) {
      if (quiz.questions && quiz.questions.length > 0) {
        for (const question of quiz.questions) {
          if (question.answers && question.answers.length > 0) {
            for (const answer of question.answers) {
              csvStream.write({
                'Quiz ID': quiz.id,
                'Quiz Title': quiz.title || '',
                'Creator Discord ID': quiz.creatorDiscordId,
                'Quiz Created': quiz.createdAt?.toISOString() || '',
                'Question ID': question.id,
                'Question Text': question.questionText || '',
                'Question Type': question.questionType || '',
                'Answer ID': answer.id,
                'Answer Text': answer.answerText || '',
                'Is Correct': answer.isCorrect ? 'Yes' : 'No',
                'User Discord ID': answer.userDiscordId || '',
                'Answer Created': answer.createdAt?.toISOString() || ''
              });
            }
          } else {
            // Question without answers
            csvStream.write({
              'Quiz ID': quiz.id,
              'Quiz Title': quiz.title || '',
              'Creator Discord ID': quiz.creatorDiscordId,
              'Quiz Created': quiz.createdAt?.toISOString() || '',
              'Question ID': question.id,
              'Question Text': question.questionText || '',
              'Question Type': question.questionType || '',
              'Answer ID': '',
              'Answer Text': '',
              'Is Correct': '',
              'User Discord ID': '',
              'Answer Created': ''
            });
          }
        }
      } else {
        // Quiz without questions
        csvStream.write({
          'Quiz ID': quiz.id,
          'Quiz Title': quiz.title || '',
          'Creator Discord ID': quiz.creatorDiscordId,
          'Quiz Created': quiz.createdAt?.toISOString() || '',
          'Question ID': '',
          'Question Text': '',
          'Question Type': '',
          'Answer ID': '',
          'Answer Text': '',
          'Is Correct': '',
          'User Discord ID': '',
          'Answer Created': ''
        });
      }
    }
    
    csvStream.end();
  } catch (error) {
    csvStream.destroy(error);
  }
}

// Function to export specific table data
async function exportTableData(tableName, res) {
  const csvStream = csv.format({ headers: true });
  csvStream.pipe(res);
  
  try {
    let data = [];
    
    switch (tableName.toLowerCase()) {
      case 'quizzes':
        data = await db.Quiz.findAll({ order: [['createdAt', 'DESC']] });
        break;
      case 'questions':
        data = await db.Question.findAll({ 
          include: [{ model: db.Quiz, as: 'quiz', attributes: ['title'] }],
          order: [['createdAt', 'DESC']] 
        });
        break;
      case 'answers':
        data = await db.Answer.findAll({ 
          include: [
            { model: db.Quiz, as: 'quiz', attributes: ['title'] },
            { model: db.Question, as: 'question', attributes: ['questionText'] }
          ],
          order: [['createdAt', 'DESC']] 
        });
        break;
      case 'wallets':
        data = await db.WalletMapping.findAll({ order: [['createdAt', 'DESC']] });
        break;
      default:
        throw new Error(`Unknown table: ${tableName}`);
    }
    
    // Convert Sequelize instances to plain objects and write to CSV
    for (const record of data) {
      csvStream.write(record.toJSON());
    }
    
    csvStream.end();
  } catch (error) {
    csvStream.destroy(error);
  }
}

// Optional: Serve static files if needed
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Status: http://localhost:${PORT}/api/status`);
});

// Start Discord bot
console.log('🤖 Starting Discord bot...');
require('./bot/index.js');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = app;
