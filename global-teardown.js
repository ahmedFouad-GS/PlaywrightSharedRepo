const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Global teardown script is running...');

module.exports = async () => {
  if (process.env.CI) {
    console.log('Skipping global teardown in CI environment.');
    return;
  }

  try {
    // Create timestamp for this run
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Paths
    const archivedDir = path.join(__dirname, 'ArchivedResults');
    const reportDir = `allure-report-${timestamp}`;
    const reportPath = path.join(archivedDir, reportDir);
    const zipName = `${reportDir}.zip`;
    const zipPath = path.join(archivedDir, zipName);

    // Ensure ArchivedResults folder exists
    if (!fs.existsSync(archivedDir)) {
      fs.mkdirSync(archivedDir);
    }

    console.log('🔄 Generating Allure Report...');
    execSync(`npx allure generate ./allure-results --clean -o "${reportPath}"`, { stdio: 'inherit' });

    console.log('📦 Zipping report into ArchivedResults...');
    execSync(`powershell -Command "Compress-Archive -Path '${reportPath}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });

    console.log(`✅ Allure report archived as ${zipPath}`);

    console.log('⏳ Waiting for file handles to close...');
    await new Promise(r => setTimeout(r, 2000)); // Wait 2s to ensure the zip is fully released

    if (process.env.AUTO_OPEN_ALLURE) {
      console.log('🌐 Opening Allure Report from extracted folder...');
      execSync(`npx allure open "${reportPath}"`, { stdio: 'inherit' });
    }

  } catch (error) {
    console.error('ℹ️ Failed to generate/open Allure report:', error);
  }
};
