// Simple script to display quiz data from the database
require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Based on the project structure, the database is likely in a data directory
// Let's check a few possible locations
const possiblePaths = [
  path.join(__dirname, 'database.sqlite'),
  path.join(__dirname, 'data', 'database.sqlite'),
  path.join(__dirname, 'src', 'database', 'database.sqlite'),
  path.join(__dirname, 'src', 'data', 'database.sqlite')
];

function findDatabasePath() {
  const fs = require('fs');
  for (const dbPath of possiblePaths) {
    try {
      if (fs.existsSync(dbPath)) {
        console.log(`Found database at: ${dbPath}`);
        return dbPath;
      }
    } catch (err) {
      // Ignore errors
    }
  }
  
  // If no database found in predefined paths, search for it
  const findDatabaseFiles = function(dir, results = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      
      if (fs.statSync(fullPath).isDirectory()) {
        if (!file.includes('node_modules')) {
          findDatabaseFiles(fullPath, results);
        }
      } else if (file.endsWith('.sqlite') || file.endsWith('.db')) {
        results.push(fullPath);
      }
    }
    return results;
  };
  
  try {
    console.log('Searching for SQLite database files...');
    const dbFiles = findDatabaseFiles(__dirname);
    
    if (dbFiles.length > 0) {
      console.log(`Found ${dbFiles.length} database files:`);
      dbFiles.forEach(file => console.log(`- ${file}`));
      return dbFiles[0]; // Return the first one
    }
  } catch (err) {
    console.error('Error searching for database files:', err);
  }
  
  return null;
}

function checkTableExists(db, tableName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
      [tableName],
      (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      }
    );
  });
}

function getAllTables(db) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table';`,
      (err, rows) => {
        if (err) reject(err);
        resolve(rows.map(row => row.name));
      }
    );
  });
}

async function showQuizData() {
  // Find the database path
  const dbPath = findDatabasePath();
  
  if (!dbPath) {
    console.error('Could not find the SQLite database file');
    return;
  }
  
  // Open the database
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Connected to the SQLite database');
  });
  
  try {
    // Check if tables exist
    const tables = await getAllTables(db);
    console.log('\nDatabase Tables:');
    tables.forEach(table => console.log(`- ${table}`));
    
    const quizzesExist = await checkTableExists(db, 'quizzes');
    
    if (!quizzesExist) {
      console.error('The "quizzes" table does not exist in this database!');
      return;
    }
    
    // Get quizzes
    db.all(`SELECT * FROM quizzes`, [], (err, quizzes) => {
      if (err) {
        console.error('Error querying quizzes:', err.message);
        return;
      }
      
      console.log(`\n=== FOUND ${quizzes.length} QUIZZES IN DATABASE ===\n`);
      
      // Process each quiz
      let processedQuizzes = 0;
      
      quizzes.forEach((quiz, i) => {
        console.log(`\n=== QUIZ #${i+1} ===`);
        console.log(`ID: ${quiz.id}`);
        console.log(`Creator Discord ID: ${quiz.creatorDiscordId}`);
        console.log(`Source URL: ${quiz.sourceUrl}`);
        console.log(`Difficulty: ${quiz.difficulty}`);
        console.log(`Token: ${quiz.tokenAddress} (Chain ID: ${quiz.chainId})`);
        console.log(`Reward Amount: ${quiz.rewardAmount}`);
        console.log(`Created: ${new Date(quiz.createdAt).toLocaleString()}`);
        console.log(`Expires: ${new Date(quiz.expiresAt).toLocaleString()}`);
        console.log(`Funding Status: ${quiz.fundingStatus}`);
        
        if (quiz.fundingTransactionHash) 
          console.log(`Funding TX: ${quiz.fundingTransactionHash}`);
        if (quiz.distributionTransactionHash) 
          console.log(`Distribution TX: ${quiz.distributionTransactionHash}`);
        if (quiz.distributedAt) 
          console.log(`Distributed At: ${new Date(quiz.distributedAt).toLocaleString()}`);
        
        // Get questions for this quiz
        db.all(
          `SELECT * FROM questions WHERE quizId = ?`,
          [quiz.id],
          (err, questions) => {
            if (err) {
              console.error(`Error querying questions for quiz ${quiz.id}:`, err.message);
              processNextQuiz();
              return;
            }
            
            console.log(`\nQuestions: ${questions.length}`);
            
            if (questions.length > 0) {
              console.log('\nQUESTIONS:');
              
              questions.forEach((question, j) => {
                console.log(`\n  Question ${j+1}: ${question.questionText}`);
                
                try {
                  const options = JSON.parse(question.options);
                  console.log('  Options:');
                  options.forEach((opt, k) => {
                    console.log(`    ${k === question.correctOptionIndex ? '*' : ' '} ${k+1}. ${opt}`);
                  });
                } catch (e) {
                  console.log(`  Error parsing options: ${e.message}`);
                }
              });
            }
            
            // Get answers for this quiz
            db.all(
              `SELECT * FROM answers WHERE quizId = ?`,
              [quiz.id],
              (err, answers) => {
                if (err) {
                  console.error(`Error querying answers for quiz ${quiz.id}:`, err.message);
                  processNextQuiz();
                  return;
                }
                
                console.log(`\nAnswers: ${answers.length}`);
                
                if (answers.length > 0) {
                  console.log('\nUSER ANSWERS:');
                  
                  answers.forEach((answer, k) => {
                    console.log(`  User ${answer.userDiscordId}`);
                    console.log(`  Question ID: ${answer.questionId}`);
                    console.log(`  Selected Option: ${answer.selectedOptionIndex}`);
                    console.log(`  Correct: ${answer.isCorrect ? 'Yes' : 'No'}`);
                    console.log(`  Answered At: ${new Date(answer.answeredAt).toLocaleString()}`);
                    console.log('');
                  });
                }
                
                processNextQuiz();
              }
            );
          }
        );
      });
      
      function processNextQuiz() {
        processedQuizzes++;
        if (processedQuizzes >= quizzes.length) {
          console.log('\nFinished displaying all quiz data');
          db.close();
        }
      }
      
      // Handle empty quizzes case
      if (quizzes.length === 0) {
        console.log('No quizzes found in the database.');
        db.close();
      }
    });
    
  } catch (error) {
    console.error('Error displaying quiz data:', error);
    db.close();
  }
}

// Run the script
showQuizData();
