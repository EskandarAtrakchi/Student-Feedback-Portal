# Student Feedback Portal

A small web application for submitting and viewing student feedback, built as part of a security-focused CA3 project.

The project intentionally includes **vulnerable** and **secure** implementations to demonstrate common OWASP Top 10 issues and their mitigations.

## Features

- User registration and login
- Create feedback posts
- Comment on posts
- Search posts by keyword
- Separate **insecure** and **secure** branches
- Logging and monitoring with Winston (secure branch)

## Technology Stack

- Node.js + Express
- EJS (server-side templates)
- SQLite3
- express-session
- bcrypt
- express-validator
- helmet
- morgan (HTTP logging)
- winston (application logging)

## Branches

- `main` – final, secure implementation
- `secure` – active development of secure implementation
- `insecure` – intentionally vulnerable version (SQL Injection, XSS, plaintext passwords, etc.)

## Prerequisites

- Node.js (LTS or later)
- npm
- Git

## Installation

Clone the repository:

```bash
git clone https://github.com/EskandarAtrakchi/Student-Feedback-Portal.git
cd Student-Feedback-Portal
npm install
