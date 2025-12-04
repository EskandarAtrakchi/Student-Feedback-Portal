const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const postsRouter = require('./routes/posts');

const db = require('./db');
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');


const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('dev'));

// insecure which it is hard-coded secret (I will fix in secure branch)
app.use(session({
  secret: 'dev-secret-123',
  resave: false,
  saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));

// Make db and session info available in routes/views if needed
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', postsRouter);

// Routes
app.use('/', indexRouter);
app.use('/', authRouter); // for /register and /login

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});