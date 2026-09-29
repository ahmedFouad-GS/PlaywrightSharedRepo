# Introduction 
This is an automation framewrok base project. It's designed to handle Web GUI , Mobile GUI and Apis with integrted pipeline.

# Setup
1. Install Node.js®
2. Install VS Code IDE and install Playwright Test for VSCode plugin and you can install Material Icon Theme for better icon visibility.
3. Clone the project in a new VS Code folder.
4. Install Playwright Framework with the following commands in order: 
    * npm install playwright --save-dev  
    * npm install @playwright/test --save-dev.
5. Install Playwright Browsers: 
    * npx playwright install.

6. Install allure-playwright intigartion 
    * npm install --save-dev @playwright/test allure-playwright

# Build and Test
To run all tests:
1. select environment  <env> [TST , STG]
2. run this command:
    * npm run <env>:web 
    
To run specific test classes:
1. select environment  <env> [TST , STG]
2. run this command:
    * npm run <env>:webfile -- <test-class-path>   ex: tests/webTests/ParkingSitesTableTest.spec.js
3. note: you can run multiple test classes with this command ex: 
    * npm run test:webfile -- tests/webTests/ParkingSitesTableTest.spec.js  tests/webTests/ParkingSitesTreeTest.spec.js
