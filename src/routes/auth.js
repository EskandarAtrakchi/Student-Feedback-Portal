const express = require('express');
const router = express.Router();
const db = require('../db.js');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const logger = require('../logger');

const SALT_ROUNDS = 10;

// GET /register
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null });
});

// POST /register (SECURE)
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long.'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      return res
        .status(400)
        .render('register', { title: 'Register', error: firstError });
    }

    const { username, password } = req.body;

    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
      if (err) {
        logger.error('Error hashing password', {
          username,
          error: err.message
        });
        return res
          .status(500)
          .render('register', { title: 'Register', error: 'Internal error.' });
      }

      const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
      db.run(query, [username, hash], function (dbErr) {
        if (dbErr) {
          logger.warn('Failed to create user', {
            username,
            error: dbErr.message
          });

          let msg = 'Could not create user.';
          if (dbErr.message && dbErr.message.includes('UNIQUE')) {
            msg = 'Username already exists.';
          }

          return res
            .status(400)
            .render('register', { title: 'Register', error: msg });
        }

        logger.info('User registered successfully', {
          userId: this.lastID,
          username
        });

        res.redirect('/login');
      });
    });
  }
);

// GET /login
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login', error: null });
});

// POST /login
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      return res
        .status(400)
        .render('login', { title: 'Login', error: firstError });
    }

    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ?';
    db.get(query, [username], (err, user) => {
      if (err) {
        logger.error('Database error during login', {
          username,
          error: err.message
        });
        return res
          .status(500)
          .render('login', { title: 'Login', error: 'Internal error.' });
      }

      if (!user) {
        logger.warn('Login failed: unknown username', { username });
        return res
          .status(401)
          .render('login', {
            title: 'Login',
            error: 'Invalid username or password.'
          });
      }

      bcrypt.compare(password, user.password_hash, (bcryptErr, match) => {
        if (bcryptErr) {
          logger.error('Bcrypt compare error', {
            username,
            error: bcryptErr.message
          });
          return res
            .status(500)
            .render('login', { title: 'Login', error: 'Internal error.' });
        }

        if (!match) {
          logger.warn('Login failed: invalid password', { username });
          return res
            .status(401)
            .render('login', {
              title: 'Login',
              error: 'Invalid username or password.'
            });
        }

        req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role
        };

        logger.info('User logged in successfully', {
          userId: user.id,
          username: user.username
        });

        res.redirect('/');
      });
    });
  }
);

// GET /logout
router.get('/logout', (req, res) => {
  const user = req.session.user;
  req.session.destroy(() => {
    if (user) {
      logger.info('User logged out', {
        userId: user.id,
        username: user.username
      });
    }
    res.redirect('/');
  });
});

module.exports = router;
