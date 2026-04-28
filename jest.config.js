module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['jest-fetch-mock'],
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  testMatch: ['**/tests/**/*.test.js']
};