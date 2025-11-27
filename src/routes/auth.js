const express = require('express');
const router = express.Router();
const db = require('../db.js');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const logger = require('../logger');

const SALT_ROUNDS = 10;

// Simple auth guard
function requireLogin(req, res, next) {
  if (!req.session.user) {
    logger.warn('Unauthenticated access to protected route', {
      path: req.path,
      method: req.method
    });
    return res.redirect('/login');
  }
  next();
}

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

/* ---------- PROFILE VIEW / UPDATE / DELETE ---------- */

// GET /profile  (view profile & edit form)
router.get('/profile', requireLogin, (req, res) => {
  const userId = req.session.user.id;

  const query = `
    SELECT id, username, role, created_at
    FROM users
    WHERE id = ?
  `;

  db.get(query, [userId], (err, user) => {
    if (err) {
      logger.error('Error loading profile', { userId, error: err.message });
      return res.status(500).send('Error loading profile.');
    }

    if (!user) {
      logger.warn('Profile requested but user not found in DB', { userId });
      return res.status(404).send('User not found.');
    }

    res.render('profile', {
      title: 'Your Profile',
      user,
      error: null,
      message: req.query.msg || ''
    });
  });
});

// POST /profile  (update username and/or password)
router.post(
  '/profile',
  requireLogin,
  [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long.'),
    body('new_password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long.')
  ],
  (req, res) => {
    const userId = req.session.user.id;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;

      // Load user again to re-render profile page with error
      const query = `
        SELECT id, username, role, created_at
        FROM users
        WHERE id = ?
      `;
      return db.get(query, [userId], (err, user) => {
        if (err || !user) {
          logger.error('Error reloading profile for validation error', {
            userId,
            error: err && err.message
          });
          return res.status(500).send('Error loading profile.');
        }

        return res.render('profile', {
          title: 'Your Profile',
          user,
          error: firstError,
          message: ''
        });
      });
    }

    const { username, new_password } = req.body;

    // Decide update query based on whether password is being changed
    if (new_password && new_password.trim() !== '') {
      // Update username + password
      bcrypt.hash(new_password, SALT_ROUNDS, (err, hash) => {
        if (err) {
          logger.error('Error hashing new password during profile update', {
            userId,
            error: err.message
          });
          return res.status(500).send('Error updating profile.');
        }

        const query = `
          UPDATE users
          SET username = ?, password_hash = ?
          WHERE id = ?
        `;
        db.run(query, [username, hash, userId], function (dbErr) {
          if (dbErr) {
            logger.error('Error updating profile with new password', {
              userId,
              error: dbErr.message
            });
            let msg = 'Error updating profile.';
            if (dbErr.message && dbErr.message.includes('UNIQUE')) {
              msg = 'Username already exists.';
            }
            return res.redirect(`/profile?msg=${encodeURIComponent(msg)}`);
          }

          // update session username
          req.session.user.username = username;

          logger.info('User updated profile (username + password)', {
            userId,
            username
          });

          return res.redirect(
            `/profile?msg=${encodeURIComponent('Profile updated successfully.')}`
          );
        });
      });
    } else {
      // Update only username
      const query = `
        UPDATE users
        SET username = ?
        WHERE id = ?
      `;
      db.run(query, [username, userId], function (dbErr) {
        if (dbErr) {
          logger.error('Error updating profile username only', {
            userId,
            error: dbErr.message
          });
          let msg = 'Error updating profile.';
          if (dbErr.message && dbErr.message.includes('UNIQUE')) {
            msg = 'Username already exists.';
          }
          return res.redirect(`/profile?msg=${encodeURIComponent(msg)}`);
        }

        req.session.user.username = username;

        logger.info('User updated profile (username only)', {
          userId,
          username
        });

        return res.redirect(
          `/profile?msg=${encodeURIComponent('Profile updated successfully.')}`
        );
      });
    }
  }
);

// GET /profile/delete  (confirm delete)
router.get('/profile/delete', requireLogin, (req, res) => {
  res.render('profile_delete', {
    title: 'Delete Account'
  });
});

// POST /profile/delete  (perform delete)
router.post('/profile/delete', requireLogin, (req, res) => {
  const userId = req.session.user.id;

  const query = 'DELETE FROM users WHERE id = ?';

  db.run(query, [userId], function (err) {
    if (err) {
      logger.error('Error deleting user account', {
        userId,
        error: err.message
      });
      return res.status(500).send('Error deleting account.');
    }

    logger.info('User account deleted', { userId });

    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

module.exports = router;
