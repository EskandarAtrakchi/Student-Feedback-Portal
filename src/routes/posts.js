const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { body, validationResult } = require('express-validator');
const logger = require('../logger');

// Middleware: require login
function requireLogin(req, res, next) {
  if (!req.session.user) {// Not logged in
    logger.warn('Unauthenticated access to protected route', {// log the attempt
      path: req.path,
      method: req.method
    });
    return res.redirect('/login');// Redirect to login
  }
  next();// Proceed if logged in
}

// LIST ALL POSTS
router.get('/posts', (req, res) => {// Fetch posts with authors
  const query = `
    SELECT posts.*, users.username AS author
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `;
  // Execute query
  db.all(query, [], (err, rows) => {
    if (err) {
      logger.error('Error fetching posts', { error: err.message });
      return res.status(500).send('Error loading posts.');
    }
    // Render posts view
    res.render('posts', {
      title: 'All Posts',
      posts: rows
    });
  });
});

// SHOW FORM TO CREATE POST
router.get('/posts/new', requireLogin, (req, res) => {
  res.render('new_post', { title: 'New Post', error: null });
});

// CREATE POST (SECURE: validation + parameterized)
router.post(
  '/posts/new',
  requireLogin,
  [ // Validation middleware
    body('title').trim().isLength({ min: 1 }).withMessage('Title is required.'),
    body('content')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Content is required.')
  ],
  (req, res) => {// Handle form submission
    const errors = validationResult(req);
    if (!errors.isEmpty()) {// Validation errors
      const firstError = errors.array()[0].msg;
      return res
        .status(400)
        .render('new_post', { title: 'New Post', error: firstError });// Show first error
    }
    // No errors then insert post
    const { title, content } = req.body;
    const userId = req.session.user.id;// Get user ID from session
    // ready statement query to prevent SQL injection
    const query = `
      INSERT INTO posts (title, content, user_id)
      VALUES (?, ?, ?)
    `;
    // Execute insertion
    db.run(query, [title, content, userId], function (err) {
      if (err) {// Insertion error
        logger.error('Error creating post', {// log the error
          error: err.message,
          userId
        });
        return res
          .status(500)
          .render('new_post', { title: 'New Post', error: 'Error saving post.' });
      }
      // Log successful post creation
      logger.info('Post created', {
        postId: this.lastID,
        userId,
        title
      });
      // Redirect to posts list
      res.redirect('/posts');
    });
  }
);

// VIEW SINGLE POST + COMMENTS
router.get('/posts/:id', (req, res) => {// Get post ID from params
  const postId = parseInt(req.params.id, 10);// Convert to integer
  if (isNaN(postId)) { // Invalid ID
    logger.warn('Invalid post ID in request', { idParam: req.params.id });
    return res.status(400).send('Invalid post ID.');
  }
  // Query to fetch post with author
  const postQuery = `
    SELECT posts.*, users.username AS author
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    WHERE posts.id = ?
  `;
// Query to fetch comments for the post
  const commentsQuery = `
    SELECT * FROM comments
    WHERE post_id = ?
    ORDER BY created_at ASC
  `;
  // Execute post query
  db.get(postQuery, [postId], (err, post) => {
    if (err) {
      logger.error('Error fetching post', { error: err.message, postId });
      return res.status(500).send('Error loading post.');
    }
    // Post not found
    if (!post) {
      logger.warn('Post not found', { postId });
      return res.status(404).send('Post not found.');
    }
    // Execute comments query
    db.all(commentsQuery, [postId], (err2, comments) => {
      if (err2) {// Error fetching comments
        logger.error('Error fetching comments', {// log the error
          error: err2.message,
          postId
        });
        return res.status(500).send('Error loading comments.');// Send error response
      }
      // Render post detail view with comments
      const msg = req.query.msg || '';
      // Render the post detail view
      res.render('post_detail', {
        title: post.title,
        post,
        comments,
        msg
      });
    });
  });
});

// ADD COMMENT (SECURE: validation + parameterized)
router.post(
  '/posts/:id/comments',
  [// Validation middleware
    body('author_name')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Name is required.'),
    body('content')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Comment content is required.')
  ],
  (req, res) => {// Handle comment submission
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {// Invalid post ID
      logger.warn('Invalid post ID in comment submission', {// log the attempt
        idParam: req.params.id
      });
      return res.status(400).send('Invalid post ID.');
    }
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Invalid comment submission', {
        postId,
        errors: errors.array()
      });
      return res.redirect(`/posts/${postId}?msg=Invalid%20comment`);
    }
    // No errors then insert comment
    const { author_name, content } = req.body;
    // ready statement query to prevent SQL injection
    const query = `
      INSERT INTO comments (post_id, content, author_name)
      VALUES (?, ?, ?)
    `;
    // Execute insertion
    db.run(query, [postId, content, author_name], function (err) {
      if (err) {// Insertion error
        logger.error('Error adding comment', {// log the error
          error: err.message,
          postId
        });
        return res.status(500).send('Error saving comment.');
      }
      // Log successful comment addition
      logger.info('Comment added', {
        commentId: this.lastID,
        postId,
        author_name
      });
      // Redirect back to post detail
      res.redirect(`/posts/${postId}?msg=Comment%20added`);
    });
  }
);

// SEARCH POSTS (SECURE: ready statekment SQL + escaped output in view)
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();// Get search query

  if (!q) {// Empty query
    return res.render('search', {
      title: 'Search',
      q: '',
      results: []
    });
  }
  // Perform search with LIKE operator
  const like = `%${q}%`;
  const query = `
    SELECT * FROM posts
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY created_at DESC
  `;
  // Execute search query
  db.all(query, [like, like], (err, rows) => {
    if (err) {// Search error
      logger.error('Error during search', {
        error: err.message,
        query: q
      });
      return res.status(500).send('Search error.');// Send error response
    }
    // Log search action
    logger.info('Search performed', {
      query: q,// log the search query
      resultCount: rows.length
    });
    // Render search results
    res.render('search', {
      title: 'Search',
      q,
      results: rows
    });
  });
});
// Export the router
module.exports = router;
