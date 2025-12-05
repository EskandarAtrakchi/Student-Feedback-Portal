# Student Feedback Portal

A simple Node.js + Express web application that lets students register, log in, and post feedback, with comments on each post.

This project is built specifically for a security assignment and has **two separate implementations**:

- `insecure` branch – intentionally vulnerable (SQL Injection, XSS, Sensitive Data Exposure).
- `secure` branch – mitigates these issues using OWASP recommendations (parameterized queries, escaping, hashing, CSRF, security headers, logging, etc).

The app uses **SQLite** as the database and **EJS** as the view engine.

---

## 1. Prerequisites

- **Node.js** (v18+ recommended, Node 20/22 works)
- **npm** (comes with Node)
- **Git**
- (Optional) [DB Browser for SQLite](https://sqlitebrowser.org/) if you want to inspect the `.sqlite` database files.

---

## 2. Getting the Code

```bash
# Clone the repository
git clone https://github.com/EskandarAtrakchi/Student-Feedback-Portal.git
cd Student-Feedback-Portal

# Install dependencies
npm install
npm run dev
```
you can change the branch and access the web application via [local host 3000](http://localhost:3000/ )