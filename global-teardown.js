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

    // Standard report path (for zipping)
    const standardReportDir = `allure-report-${timestamp}`;
    const standardReportPath = path.join(archivedDir, standardReportDir);
    const zipName = `${standardReportDir}.zip`;
    const zipPath = path.join(archivedDir, zipName);

    // Single-file temp folder and final HTML file path
    const tempSingleOutputDir = path.join(archivedDir, `temp-single-${timestamp}`);
    const finalSingleHtmlPath = path.join(archivedDir, `allure-report-single-${timestamp}.html`);

    // Ensure ArchivedResults folder exists
    if (!fs.existsSync(archivedDir)) {
      fs.mkdirSync(archivedDir);
    }

    // 1. Generate the standard multi-file report
    console.log('🔄 Generating Standard Allure Report...');
    execSync(`npx allure generate ./allure-results --clean -o "${standardReportPath}"`, { stdio: 'inherit' });

    // 2. Generate the single-file report into a temporary folder
    console.log('🔄 Generating Single-File Allure Report...');
    execSync(`npx allure generate ./allure-results --single-file --clean -o "${tempSingleOutputDir}"`, { stdio: 'inherit' });

    // 3. Rename/Move index.html to your custom named file and clean up temp folder
    const generatedHtml = path.join(tempSingleOutputDir, 'index.html');
    if (fs.existsSync(generatedHtml)) {
      fs.renameSync(generatedHtml, finalSingleHtmlPath);
      // Remove the now-empty temporary directory
      fs.rmdirSync(tempSingleOutputDir);
      console.log(`✅ Single-file HTML archived as: ${finalSingleHtmlPath}`);
    }

    // 4. Zip the standard multi-file report
    console.log('📦 Zipping standard report into ArchivedResults...');
    execSync(`powershell -Command "Compress-Archive -Path '${standardReportPath}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
    console.log(`✅ Allure report archived as ${zipPath}`);

    // 5. Delete the unzipped folder that was just zipped
    if (fs.existsSync(standardReportPath)) {
      console.log('Cleaning process...');
      fs.rmSync(standardReportPath, { recursive: true, force: true });
    }

    // 6. Handle auto-opening the final named single HTML file
    const autoOpenAllureReport = true; 
    if (autoOpenAllureReport) {
      if (fs.existsSync(finalSingleHtmlPath)) {
        console.log(`🌐 Opening Single-File Allure Report: ${path.basename(finalSingleHtmlPath)}`);
        execSync(`powershell -Command "Start-Process '${finalSingleHtmlPath}'"`, { stdio: 'inherit' });
      } else {
        console.warn('⚠️ Could not find the single-file HTML to open.');
      }
    }

  } catch (error) {
    console.error('ℹ️ Failed to generate/open Allure report:', error);
  }
};
