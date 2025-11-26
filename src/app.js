const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const helmet = require('helmet');
require('dotenv').config();

const db = require('./db');             // THIS – not ./db.sqlite or ./db_secure.sqlite
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Security headers
app.use(helmet());

// HTTP logging
app.use(morgan('dev'));

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

app.use(express.static(path.join(__dirname, 'public')));

// Expose currentUser to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// Routes
app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', postsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('An internal error occurred.');
});

app.listen(PORT, () => {
  console.log(`Secure app running on http://localhost:${PORT}`);
});
