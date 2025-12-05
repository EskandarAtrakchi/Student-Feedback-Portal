# Student Feedback Portal

A simple Node.js + Express web application that lets students register, log in, and post feedback, with comments on each post.

This project is built specifically for a security assignment only feel free to use it:

- `insecure` branch – intentionally vulnerable (SQL Injection, XSS, Sensitive Data Exposure).
- `secure` branch – mitigates these issues using OWASP recommendations (parameterized queries, escaping, hashing, CSRF, security headers, logging, etc).

The app uses **SQLite3** as the database and **EJS** as the view engine.

----

## 1. Prerequisites

- **Node.js** (v18+ recommended, Node 20/22 works)
- **npm** (comes with Node)
- **Git**

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

## 3. Alternative access:
I have hosted the two branches on render you can access them 

### insecure: https://student-feedback-portal-insecure.onrender.com 
### secure: https://student-feedback-portal-05vc.onrender.com
