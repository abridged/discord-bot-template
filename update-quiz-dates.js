// Script to update all quiz creation dates
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Find the database file
function findDatabaseFile() {
  const possiblePaths = [
    path.join(__dirname, 'db', 'database.sqlite'),
    path.join(__dirname, 'src', 'db', 'database.sqlite')
  ];
  
  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      console.log(`Found database at: ${dbPath}`);
      return dbPath;
    }
  }
  
  console.error('Database file not found!');
  process.exit(1);
}

// Connect to the database
const dbPath = findDatabaseFile();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database');
});

// Set the new date - May 21, 2025 (9:59 PM)
const newDate = new Date(2025, 4, 21, 21, 59, 0).toISOString(); // Month is 0-indexed in JS
console.log(`Setting all quiz creation dates to: ${newDate}`);

// Update all quiz creation dates
db.run(`UPDATE quizzes SET createdAt = ?`, [newDate], function(err) {
  if (err) {
    console.error('Error updating quiz creation dates:', err.message);
  } else {
    console.log(`Updated creation dates for ${this.changes} quizzes`);
    
    // Update expiry dates to tomorrow (May 22, 2025, 5:59:59 PM)
    const expiryDate = new Date(2025, 4, 22, 17, 59, 59).toISOString();
    console.log(`Setting all quiz expiry dates to: ${expiryDate}`);
    
    db.run(`UPDATE quizzes SET expiresAt = ?`, [expiryDate], function(err) {
      if (err) {
        console.error('Error updating quiz expiry dates:', err.message);
      } else {
        console.log(`Updated expiry dates for ${this.changes} quizzes`);
        
        // Update funding status for testing
        db.run(`UPDATE quizzes SET fundingStatus = 'funded' WHERE id IN (
          SELECT id FROM quizzes ORDER BY id LIMIT 2
        )`, function(err) {
          if (err) {
            console.error('Error updating funding status:', err.message);
          } else {
            console.log(`Updated funding status to 'funded' for ${this.changes} quizzes`);
            
            // Verify the updates
            db.all(`SELECT id, createdAt, expiresAt, fundingStatus FROM quizzes`, [], (err, rows) => {
              if (err) {
                console.error('Error verifying updates:', err.message);
              } else {
                console.log('\nVerification of updated quizzes:');
                rows.forEach((row, i) => {
                  console.log(`Quiz #${i+1} (${row.id}):`);
                  console.log(`  Created: ${new Date(row.createdAt).toLocaleString()}`);
                  console.log(`  Expires: ${new Date(row.expiresAt).toLocaleString()}`);
                  console.log(`  Funding Status: ${row.fundingStatus}`);
                  console.log();
                });
              }
              
              // Close the database connection
              db.close((err) => {
                if (err) {
                  console.error('Error closing database:', err.message);
                } else {
                  console.log('Database connection closed');
                }
              });
            });
          }
        });
      }
    });
  }
});
