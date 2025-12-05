// playwright.config.js
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3000',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
