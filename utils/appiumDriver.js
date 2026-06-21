const { remote } = require('webdriverio');
const config = require('../appium.config');

let driver;

module.exports = {
  async initDriver() {
    driver = await remote({
      hostname: config.host,
      port: config.port,
      path: config.path,
      capabilities: config.capabilities,
      connectionRetryCount: 3,
      connectionRetryTimeout: 90000,
      logLevel: config.logLevel
    });
    return driver;
  },

  async quitDriver() {
    if (driver) {
      await driver.deleteSession();
      driver = null;
    }
  }
};