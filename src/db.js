const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Use a separate DB file for the secure version
// This avoids conflicts with the insecure branch's db.sqlite
const dbPath = path.join(__dirname, '..', 'db_secure.sqlite');
// Initialize SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {// Handle connection error
    console.error('Failed to connect to SQLite database:', err);
  } else {// Successful connection
    console.log('Connected to SQLite database at', dbPath);
  }
});
// Create tables if they don't exist
db.serialize(() => {
  // SECURE users table with password_hash
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // SECURE posts table with user_id foreign key
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  // SECURE comments table with post_id foreign key
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id)
    )
  `);
});
// Export the database connection
module.exports = db;
