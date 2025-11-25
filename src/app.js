const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');

const db = require('./db');        // <--- ADD THIS
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth'); // <--- we'll create this next


// port setup 
const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', indexRouter);

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
