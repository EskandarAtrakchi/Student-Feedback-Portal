const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { body, validationResult } = require('express-validator');

// Middleware: require login
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// LIST ALL POSTS
router.get('/posts', (req, res) => {
  const query = `
    SELECT posts.*, users.username AS author
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching posts:', err);
      return res.status(500).send('Error loading posts.');
    }

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
  [
    body('title').trim().isLength({ min: 1 }).withMessage('Title is required.'),
    body('content').trim().isLength({ min: 1 }).withMessage('Content is required.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      return res.status(400).render('new_post', { title: 'New Post', error: firstError });
    }

    const { title, content } = req.body;
    const userId = req.session.user.id;

    const query = `
      INSERT INTO posts (title, content, user_id)
      VALUES (?, ?, ?)
    `;

    db.run(query, [title, content, userId], function (err) {
      if (err) {
        console.error('Error creating post:', err);
        return res.status(500).render('new_post', { title: 'New Post', error: 'Error saving post.' });
      }
      res.redirect('/posts');
    });
  }
);

// VIEW SINGLE POST + COMMENTS
router.get('/posts/:id', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) {
    return res.status(400).send('Invalid post ID.');
  }

  const postQuery = `
    SELECT posts.*, users.username AS author
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    WHERE posts.id = ?
  `;

  const commentsQuery = `
    SELECT * FROM comments
    WHERE post_id = ?
    ORDER BY created_at ASC
  `;

  db.get(postQuery, [postId], (err, post) => {
    if (err || !post) {
      console.error('Error fetching post:', err);
      return res.status(404).send('Post not found.');
    }

    db.all(commentsQuery, [postId], (err2, comments) => {
      if (err2) {
        console.error('Error fetching comments:', err2);
        return res.status(500).send('Error loading comments.');
      }

      const msg = req.query.msg || '';

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
  [
    body('author_name').trim().isLength({ min: 1 }).withMessage('Name is required.'),
    body('content').trim().isLength({ min: 1 }).withMessage('Comment content is required.')
  ],
  (req, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).send('Invalid post ID.');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // For simplicity, just redirect back with a message
      return res.redirect(`/posts/${postId}?msg=Invalid%20comment`);
    }

    const { author_name, content } = req.body;

    const query = `
      INSERT INTO comments (post_id, content, author_name)
      VALUES (?, ?, ?)
    `;

    db.run(query, [postId, content, author_name], function (err) {
      if (err) {
        console.error('Error adding comment:', err);
        return res.status(500).send('Error saving comment.');
      }

      res.redirect(`/posts/${postId}?msg=Comment%20added`);
    });
  }
);

// SEARCH POSTS (SECURE: parameterized + escaped output in view)
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.render('search', {
      title: 'Search',
      q: '',
      results: []
    });
  }

  const like = `%${q}%`;
  const query = `
    SELECT * FROM posts
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY created_at DESC
  `;

  db.all(query, [like, like], (err, rows) => {
    if (err) {
      console.error('Error during search:', err);
      return res.status(500).send('Search error.');
    }

    res.render('search', {
      title: 'Search',
      q,
      results: rows
    });
  });
});

module.exports = router;
