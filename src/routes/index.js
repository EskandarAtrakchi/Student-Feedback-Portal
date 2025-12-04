const express = require('express');
const router = express.Router();
// GET home page.
router.get('/', (req, res) => {
  // Render the index view with a title
  res.render('index', { title: 'Student Feedback Portal' });
});
// Export the router
module.exports = router;
