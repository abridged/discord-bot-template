module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  // Ignore specific files that are mock implementations but not actual test files
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/__tests__/mocks/ethersjs.js',
    '/src/__tests__/mocks/ethersjs.special.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/bot/deploy-commands.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  coverageDirectory: 'coverage',
};
