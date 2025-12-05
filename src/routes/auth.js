const express = require('express');
const router = express.Router();
const db = require('../db.js');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const logger = require('../logger');

const saltRounds = 10; //the higher the rounds the more secure but slower

/* ---------- REGISTRATION / LOGIN / LOGOUT ---------- */

// Simple auth guard
function requireLogin(req, res, next) {
  // Check if user is logged in 
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
  // Render registration form
  res.render('register', { title: 'Register', error: null });
});

// POST /register (SECURE)
router.post(
  '/register',
  [
    // Validate inputs
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long.'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.')
  ],
  // Handle registration logic
  (req, res) => {
    const errors = validationResult(req);
    // Check for validation errors
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      return res
        .status(400)
        .render('register', { title: 'Register', error: firstError });
    }

    // Extract username and password from request body
    const { username, password } = req.body;

    // Hash password and store user in DB 
    bcrypt.hash(password, saltRounds, (err, hash) => {
      // Handle hashing errors
      if (err) {
        logger.error('Error hashing password', {
          username,
          error: err.message
        });
        return res
          .status(500)
          .render('register', { title: 'Register', error: 'Internal error.' });
      }

      // Insert new user into database 
      const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
      db.run(query, [username, hash], function (dbErr) {
        // Handle DB errors for example duplicate username
        if (dbErr) {
          logger.warn('Failed to create user', {
            username,
            error: dbErr.message
          });

          // Check for unique constraint violation 
          let msg = 'Could not create user.';
          // Adjust message for duplicate username
          if (dbErr.message && dbErr.message.includes('UNIQUE')) {
            msg = 'Username already exists.';
          }
          // Render registration form with error message
          return res
            .status(400)
            .render('register', { title: 'Register', error: msg });
        }
        // Log successful registration
        logger.info('User registered successfully', {
          userId: this.lastID,
          username
        });

        // Redirect to login page after successful registration
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
  // Validate inputs
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  // Handle login logic
  (req, res) => {
    const errors = validationResult(req);
    // Check for validation errors
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      return res
        .status(400)
        .render('login', { title: 'Login', error: firstError });
    }
    // Extract username and password from request body
    const { username, password } = req.body;
    // Retrieve user from database
    const query = 'SELECT * FROM users WHERE username = ?';
    db.get(query, [username], (err, user) => {
      // Handle DB errors 
      if (err) {
        logger.error('Database error during login', {
          username,
          error: err.message
        });
        return res
          .status(500)
          .render('login', { title: 'Login', error: 'Internal error.' });
      }
      // Check if user exists
      if (!user) {
        logger.warn('Login failed: unknown username', { username });
        return res
          .status(401)
          .render('login', {
            title: 'Login',
            error: 'Invalid username or password.'
          });
      }
      // Compare provided password with stored hash
      bcrypt.compare(password, user.password_hash, (bcryptErr, match) => {
        // Handle bcrypt errors
        if (bcryptErr) {
          logger.error('Bcrypt compare error', {
            username,
            error: bcryptErr.message
          });
          return res
            .status(500)
            .render('login', { title: 'Login', error: 'Internal error.' });
        }

        // Check if password matches 
        if (!match) {
          // Invalid password
          logger.warn('Login failed: invalid password', { username });
          return res
            .status(401)
            .render('login', {
              title: 'Login',
              error: 'Invalid username or password.'
            });
        }

        // Successful login: set session user
        req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role
        };

        // Log successful login
        logger.info('User logged in successfully', {
          userId: user.id,
          username: user.username
        });

        // Redirect to home page after successful login
        res.redirect('/');
      });
    });
  }
);
// GET /logout
router.get('/logout', (req, res) => {
  // Log user logout action
  const user = req.session.user;
  req.session.destroy(() => {
    // Log after session destroyed
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
  // Load user info from DB
  const userId = req.session.user.id;

  const query = `
    SELECT id, username, role, created_at
    FROM users
    WHERE id = ?
  `;
  // Fetch user from database
  db.get(query, [userId], (err, user) => {
    // Handle DB errors
    if (err) {
      logger.error('Error loading profile', { userId, error: err.message });
      return res.status(500).send('Error loading profile.');
    }
    // Check if user exists
    if (!user) {
      logger.warn('Profile requested but user not found in DB', { userId });
      return res.status(404).send('User not found.');
    }

    // Render profile page with user data
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
    // Validate inputs
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long.'),
    body('new_password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long.')
  ],
  // Handle profile update logic
  (req, res) => {
    const userId = req.session.user.id;
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;

      // Load user again to re-render profile page with error
      const query = `
        SELECT id, username, role, created_at
        FROM users
        WHERE id = ?
      `;
      return db.get(query, [userId], (err, user) => {
        // Handle DB errors
        if (err || !user) {
          logger.error('Error reloading profile for validation error', {
            userId,
            error: err && err.message
          });
          return res.status(500).send('Error loading profile.');
        }

        // Render profile with error message
        return res.render('profile', {
          title: 'Your Profile',
          user,
          error: firstError,
          message: ''
        });
      });
    }
    // No validation errors proceed with update
    const { username, new_password } = req.body;

    // Decide update query based on whether password is being changed
    if (new_password && new_password.trim() !== '') {
      // Update username + password
      bcrypt.hash(new_password, saltRounds, (err, hash) => {
        // Handle hashing errors
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
        // Execute update query
        db.run(query, [username, hash, userId], function (dbErr) {
          if (dbErr) {
            logger.error('Error updating profile with new password', {
              userId,
              error: dbErr.message
            });
            let msg = 'Error updating profile.';
            // Adjust message for duplicate username
            if (dbErr.message && dbErr.message.includes('UNIQUE')) {
              msg = 'Username already exists.';
            }
            return res.redirect(`/profile?msg=${encodeURIComponent(msg)}`);
          }

          // update session username
          req.session.user.username = username;
          // Log profile update
          logger.info('User updated profile (username + password)', {
            userId,
            username
          });
          // Redirect back to profile with success message
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
        // update session username
        req.session.user.username = username;
        // Log profile update
        logger.info('User updated profile (username only)', {
          userId,
          username
        });
        // Redirect back to profile with success message
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
  // Delete user from database
  const query = 'DELETE FROM users WHERE id = ?';
  // Execute delete query
  db.run(query, [userId], function (err) {
    if (err) {
      logger.error('Error deleting user account', {
        userId,
        error: err.message
      });
      return res.status(500).send('Error deleting account.');
    }
    // Log account deletion
    logger.info('User account deleted', { userId });
    // Destroy session and redirect to home
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});
// Export the router
module.exports = router;
