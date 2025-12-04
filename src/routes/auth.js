const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /register
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null });
});

// POST /register (insecure: plaintext password)
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  // insecure: no validation, no hashing, string concatenation
  const query = `
    INSERT INTO users (username, password)
    VALUES ('${username}', '${password}')
  `;

  db.run(query, function (err) {
    if (err) {
      console.error('Error creating user:', err);
      return res.render('register', { title: 'Register', error: 'Username may already exist or input invalid.' });
    }
    res.redirect('/login');
  });
});

// GET /login
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login', error: null });
});

// POST /login (insecure: SQL Injection possible)
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // very insecure: vulnerable to SQL injection
  const query = `
    SELECT * FROM users
    WHERE username = '${username}' AND password = '${password}'
  `;

  db.get(query, (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.render('login', { title: 'Login', error: 'Error occurred.' });
    }
    if (!user) {
      return res.render('login', { title: 'Login', error: 'Invalid username or password.' });
    }

    // Login success
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    res.redirect('/');
  });
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
