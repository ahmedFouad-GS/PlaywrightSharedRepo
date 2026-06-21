const fs = require('fs');

// ─── Test Data Helper ─────────────────────────────────────────────────────────
// Reads a JSON test data file from the environment-specific data folder.
// Path is relative to ./data/${PW_ENV_NAME}webTestData/
//
// Usage:
//   const { readTestData } = require('../../utils/testData.js');
//   const testData = readTestData('ReportsTestData/PaymentChannelsTestData.json');
//   const loginData = readTestData('LoginTestData.json');

function readTestData(relPath) {
  return JSON.parse(fs.readFileSync(`./data/${process.env.PW_ENV_NAME}webTestData/${relPath}`, 'utf8'));
}

module.exports = { readTestData };
