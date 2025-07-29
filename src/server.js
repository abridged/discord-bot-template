const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

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
