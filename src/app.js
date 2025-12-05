const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const helmet = require('helmet');
const logger = require('./logger');
const csrf = require('csurf');

require('dotenv').config();// Load environment variables from .env file

const db = require('./db');// this is not ./db.sqlite or ./db_secure.sqlite
const indexRouter = require('./routes/index');// Home route
const authRouter = require('./routes/auth');// Authentication routes
const postsRouter = require('./routes/posts');// Blog post routes

const app = express();// Create Express app
const PORT = process.env.PORT || 3000;// Define port

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// HTTP logging
app.use(morgan('dev'));
// Body parsing middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session config (uses .env)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Security headers
app.use(helmet());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Expose currentUser to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// CSRF protection (uses session)
const csrfProtection = csrf();
// Apply CSRF protection to all POST, PUT, DELETE routes
app.use(csrfProtection);

// Make csrfToken available in all EJS views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.currentUser = req.session.user || null; // you probably already have this
  next();
});

// Routes
app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', postsRouter);

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('Invalid CSRF token', {
      path: req.path,
      method: req.method,
      user: req.session.user ? req.session.user.username : 'guest',
    });
    return res.status(403).send('Form tampered with or session expired.');
  }
  next(err);
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).send('An internal error occurred.');// Generic error message
});
// Start server
app.listen(PORT, () => {
  logger.info(`Secure app running on http://localhost:${PORT}`);
  console.log(`Secure app running on http://localhost:${PORT}`);
});
