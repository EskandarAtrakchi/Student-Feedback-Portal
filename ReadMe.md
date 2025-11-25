# Security Analysis of Insecure Implementation and Planned Mitigations

1. Overview of the Insecure Implementation

The current insecure branch of the Student Feedback Portal has been deliberately designed to include common web application vulnerabilities for educational purposes. These vulnerabilities map directly to several OWASP Top 10 categories, including:

Injection (A03:2021) – SQL Injection in login, post creation, and search.

Cross-Site Scripting – XSS (A03:2021 / historically A07) – stored, reflected, and DOM-based.

Cryptographic Failures (A02:2021) – previously called “Sensitive Data Exposure”.

Security Logging and Monitoring Failures (A09:2021) – initially limited or missing logging.

In the secure branch, each of these issues will be systematically addressed using recommended practices from the OWASP Cheat Sheets and general secure coding guidelines.

2. Identified Insecurities in the Current Code
2.1 SQL Injection Vulnerabilities

Where it occurs

Login (POST /login) – auth.js:

const query = `
  SELECT * FROM users
  WHERE username = '${username}' AND password = '${password}'
`;
db.get(query, (err, user) => { ... });


User registration (POST /register) – auth.js:

const query = `
  INSERT INTO users (username, password)
  VALUES ('${username}', '${password}')
`;
db.run(query, function (err) { ... });


Create post (POST /posts/new) – posts.js:

const query = `
  INSERT INTO posts (title, content, user_id)
  VALUES ('${title}', '${content}', ${userId})
`;


View post (GET /posts/:id) – posts.js:

const postQuery = `
  SELECT posts.*, users.username AS author
  FROM posts
  LEFT JOIN users ON posts.user_id = users.id
  WHERE posts.id = ${postId}
`;


Add comment (POST /posts/:id/comments) – posts.js:

const query = `
  INSERT INTO comments (post_id, content, author_name)
  VALUES (${postId}, '${content}', '${author_name}')
`;


Search (GET /search) – posts.js:

const query = `
  SELECT * FROM posts
  WHERE title LIKE '%${q}%' OR content LIKE '%${q}%'
  ORDER BY created_at DESC
`;


Why this is insecure

All these queries are built using string concatenation with unsanitised user input.

An attacker can inject crafted SQL (e.g. ' OR '1'='1 or '; DROP TABLE users; --) to:

Bypass authentication.

Access or modify data without authorization.

Potentially delete or corrupt data.

Planned fix in secure branch

Replace all concatenated SQL strings with parameterized queries using ? placeholders, e.g.:

const query = 'SELECT * FROM users WHERE username = ?';
db.get(query, [username], ...);


Centralise database access helper functions to ensure that every query uses parameters.

Add input validation before queries (e.g. using express-validator) to further reduce attack surface.

2.2 Cross-Site Scripting (XSS) Vulnerabilities

The application currently demonstrates three types of XSS:

2.2.1 Stored XSS

Where it occurs

Post content and title in post_detail.ejs and posts.ejs:

<!-- posts.ejs -->
<a href="/posts/<%= post.id %>"><%- post.title %></a>

<!-- post_detail.ejs -->
<h2><%- post.title %></h2>
<div>
  <%- post.content %>
</div>


Comment content in post_detail.ejs:

<span><%- c.content %></span>


Note: <%- ... %> in EJS outputs unescaped HTML, so any stored <script> tag is executed in the browser.

Why this is insecure

If a user submits a post or comment containing:

<script>alert('XSS');</script>


this script will run for every user who views that post.

This can be used to steal session cookies, deface the site, or perform actions on behalf of other users.

Planned fix in secure branch

Replace unescaped EJS tags <%- ... %> with escaped tags <%= ... %> wherever user-controlled data is output:

<h2><%= post.title %></h2>
<div><%= post.content %></div>


Optionally, use an HTML sanitization library or strict validation to only allow safe content.

Apply context-appropriate encoding (HTML, attribute, JavaScript) according to OWASP XSS Prevention guidance.

2.2.2 Reflected XSS

Where it occurs

Search page search.ejs:

<% if (q) { %>
  <p>You searched for: <%- q %></p>  <!-- reflected XSS -->
<% } %>


The query parameter q is taken from the URL and written back to the page using raw HTML, allowing URLs such as:

/search?q=<script>alert('XSS')</script>


Why this is insecure

Attackers can craft a link that injects arbitrary HTML/JavaScript into the page when the victim clicks it.

This can be used in phishing or social engineering attacks where the malicious link looks like a legitimate search link.

Planned fix in secure branch

Use escaped EJS output:

<p>You searched for: <%= q %></p>


Add server-side validation to restrict q to safe characters or patterns.

Consider implementing a Content Security Policy (CSP) header (e.g. via helmet) to reduce XSS impact.

2.2.3 DOM-based XSS

Where it occurs

In post_detail.ejs:

<div id="status"></div>

<script>
  // INSECURE: DOM-based XSS using innerHTML
  const params = new URLSearchParams(window.location.search);
  const msg = params.get('msg');
  if (msg) {
    document.getElementById('status').innerHTML = msg;
  }
</script>


Why this is insecure

User-controlled data from ?msg= is inserted directly into the DOM with innerHTML.

A URL like:

/posts/1?msg=<script>alert('DOM XSS')</script>


will execute arbitrary JavaScript.

Planned fix in secure branch

Replace innerHTML with textContent or innerText so any HTML is treated as text:

document.getElementById('status').textContent = msg;


Avoid using dangerous DOM sinks (innerHTML, outerHTML, document.write) with untrusted data.

2.3 Sensitive Data Exposure / Cryptographic Failures
2.3.1 Plaintext Password Storage

Where it occurs

POST /register in auth.js:

const query = `
  INSERT INTO users (username, password)
  VALUES ('${username}', '${password}')
`;


The users table stores passwords directly in a password column, not hashed.

Why this is insecure

If the database is leaked, attackers immediately obtain all user passwords.

Users tend to reuse passwords across sites, so this can lead to “password stuffing” attacks elsewhere.

Planned fix in secure branch

Introduce a password_hash column and use bcrypt to hash passwords before storing:

bcrypt.hash(password, saltRounds, (err, hash) => {
  const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
  db.run(query, [username, hash], ...);
});


Compare using bcrypt.compare during login.

Never store or log plaintext passwords.

2.3.2 Hard-coded Secrets in Source Code

Where it occurs

In app.js:

app.use(session({
  secret: 'dev-secret-123',
  resave: false,
  saveUninitialized: false
}));


Why this is insecure

Secrets hard-coded in the repository can be leaked via GitHub or file sharing.

Attackers with the secret can tamper with or forge session cookies.

Planned fix in secure branch

Use environment variables via dotenv and .env file (not committed to Git):

require('dotenv').config();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));


Ensure .env is included in .gitignore and never pushed.

2.3.3 Verbose Error Messages and Minimal Validation

Where it occurs

Various routes log entire error objects to the console and sometimes show generic error messages.

Input validation is largely missing (e.g. no checks on length, type, or allowed characters).

Why this is insecure

Without proper validation, unexpected input may cause undesirable behaviour.

If detailed errors were ever shown to users, they might reveal table names, SQL queries, or stack traces.

Planned fix in secure branch

Add server-side validation using middleware (e.g. express-validator) for login, registration, posts, comments, and search.

Keep user-facing error messages generic, while logging detailed technical errors to a secure log file.

Ensure try/catch or error handlers do not leak stack traces in production mode.

2.4 Logging and Monitoring Weaknesses

Current state

The app uses morgan('dev') for basic HTTP access logging.

There is no structured application logging for:

Failed logins.

Suspicious inputs (e.g. obvious SQL injection / XSS patterns).

Security-relevant events (e.g. multiple failed login attempts).

Why this is a problem

According to OWASP, insufficient logging and monitoring makes it difficult to:

Detect and respond to attacks.

Investigate incidents.

Meet regulatory or compliance requirements.

Planned fix in secure branch

Keep morgan for HTTP access logs.

Add a dedicated logger (e.g. winston) to record:

Authentication failures.

Unexpected exceptions.

Potentially malicious input patterns.

Store logs in a file (e.g. logs/app.log) and ensure they are rotated / protected.

Consider basic monitoring or manual review procedures as part of the testing and deployment process.

3. Summary: What the Secure Branch Will Achieve

The secure branch will:

Eliminate SQL Injection

Replace all string-built queries with parameterized queries.

Add input validation to reduce attack surface.

Eliminate XSS (Stored, Reflected, DOM-based)

Use escaped EJS output (<%= %>) instead of unescaped (<%- %>) for user-controlled data.

Use safe DOM APIs (textContent instead of innerHTML) for client-side rendering.

Optionally apply CSP headers via helmet.

Mitigate Sensitive Data Exposure / Cryptographic Failures

Hash passwords with bcrypt instead of storing plaintext.

Move secrets (session secret) into environment variables.

Avoid leaking sensitive error details to users while retaining them in secure logs.

Improve Logging and Monitoring

Add structured logging of authentication events and errors.

Make it easier to detect attacks, troubleshoot issues, and document security posture.

These changes will be justified with references to OWASP Top 10 categories and OWASP Cheat Sheets (Injection Prevention, XSS Prevention, Password Storage, and Logging & Monitoring), and will be demonstrated through updated code, screenshots, and testing (including OWASP ZAP) in the secure implementation.