// tests/e2e.spec.js
const { test, expect } = require('@playwright/test');

test('register, login, create post, search', async ({ page }) => {
  const username = 'playwrightUser' + Date.now();
  const password = 'Password123!';

  // Register
  await page.goto('/register');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Login
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page.locator('text=Logged in as')).toContainText(username);

  // Create post
  await page.goto('/posts/new');
  await page.fill('input[name="title"]', 'Playwright test post');
  await page.fill('textarea[name="content"]', 'This post was created by an automated test.');
  await page.click('button[type="submit"]');

  // Verify post is visible
  await expect(page.locator('text=Playwright test post')).toBeVisible();

  // Search for the post
  await page.goto('/search?q=Playwright');
  await expect(page.locator('text=Playwright test post')).toBeVisible();
});
