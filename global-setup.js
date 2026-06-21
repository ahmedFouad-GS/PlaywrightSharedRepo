const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const dir = './allure-results';
  console.log('🔄 Ensuring Allure results directory exists...');

  // If directory doesn't exist, create it
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    console.log('📁 Created directory:', dir);
  } else {
    // Clean up existing files
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    console.log('✅ Allure results cleared.');
  }
};
