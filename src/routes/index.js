const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { title: 'Student Feedback Portal' });
});

module.exports = router;
