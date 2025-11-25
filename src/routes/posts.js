const express = require('express');
const router = express.Router();
const db = require('../db');

// Simple middleware: require login for some routes
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
      return res.status(500).send('Error loading posts');
    }

    res.render('posts', {
      title: 'All Posts',
      posts: rows
    });
  });
});

// SHOW FORM TO CREATE POST (LOGIN REQUIRED)
router.get('/posts/new', requireLogin, (req, res) => {
  res.render('new_post', { title: 'New Post', error: null });
});

// CREATE POST (INSECURE: XSS + SQL injection risk through title/content)
router.post('/posts/new', requireLogin, (req, res) => {
  const { title, content } = req.body;
  const userId = req.session.user.id;

  // INSECURE: string concatenation into SQL
  const query = `
    INSERT INTO posts (title, content, user_id)
    VALUES ('${title}', '${content}', ${userId})
  `;

  db.run(query, function (err) {
    if (err) {
      console.error('Error creating post:', err);
      return res.render('new_post', { title: 'New Post', error: 'Error saving post' });
    }
    res.redirect('/posts');
  });
});

// VIEW SINGLE POST + COMMENTS
router.get('/posts/:id', (req, res) => {
  const postId = req.params.id;

  const postQuery = `
    SELECT posts.*, users.username AS author
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    WHERE posts.id = ${postId}        -- INSECURE: direct interpolation
  `;

  const commentsQuery = `
    SELECT * FROM comments
    WHERE post_id = ${postId}
    ORDER BY created_at ASC
  `;

  db.get(postQuery, (err, post) => {
    if (err || !post) {
      console.error('Error fetching post:', err);
      return res.status(404).send('Post not found');
    }

    db.all(commentsQuery, (err2, comments) => {
      if (err2) {
        console.error('Error fetching comments:', err2);
        return res.status(500).send('Error loading comments');
      }

      res.render('post_detail', {
        title: post.title,
        post,
        comments
      });
    });
  });
});

// ADD COMMENT (INSECURE XSS + SQL injection risk)
router.post('/posts/:id/comments', (req, res) => {
  const postId = req.params.id;
  const { author_name, content } = req.body;

  const query = `
    INSERT INTO comments (post_id, content, author_name)
    VALUES (${postId}, '${content}', '${author_name}')
  `;

  db.run(query, function (err) {
    if (err) {
      console.error('Error adding comment:', err);
      return res.status(500).send('Error saving comment');
    }

    // add msg parameter to demonstrate DOM-based XSS later
    res.redirect(`/posts/${postId}?msg=Comment%20added`);
  });
});

// SEARCH POSTS (INSECURE: SQL injection + reflected XSS)
router.get('/search', (req, res) => {
  const q = req.query.q || '';

  if (!q) {
    return res.render('search', {
      title: 'Search',
      q,
      results: []
    });
  }

  // INSECURE: direct concatenation - SQL injection
  const query = `
    SELECT * FROM posts
    WHERE title LIKE '%${q}%' OR content LIKE '%${q}%'
    ORDER BY created_at DESC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error during search:', err);
      return res.status(500).send('Search error');
    }

    res.render('search', {
      title: 'Search',
      q,
      results: rows
    });
  });
});

module.exports = router;
