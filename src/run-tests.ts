import AITestAutomation from './index';

async function main() {
    const automation = new AITestAutomation();
    
    try {
        // Initialize the automation system
        console.log('Initializing test automation...');
        await automation.initialize();

        // Define your product context
        const productContext = `
            Cindi.ai is an AI-powered platform that helps users manage and automate their workflows. The URL to login is https://app.cindi.ai/auth/login
            
            Key Features:
            - User authentication and login
            - Dashboard with workflow overview
            - Workflow creation and management
            - AI-powered task automation
            - User profile management
            
            User Flows:
            - User registration and login
            - Creating a new workflow
            - Managing existing workflows
            - Configuring AI automation settings
            - Updating user profile information

            The only user flows I want tested are the following 2:
            - User opens the login page, tries to login with some dummy credentials, and gets some visual feedback that the credentials are invalid.
            - User now tries to enter correct credentials, clicks login, and is redirected to the dashboard [email: kianfay@gmail.com, password: password], and the test wait for the dashboard to appear
        `;

        // Analyze the product and generate a single test scenario
        console.log('Analyzing product and generating test scenario...');
        const scenario = await automation.analyzeProduct(
            process.env.BASE_URL || 'https://app.cindi.ai/auth/login',
            productContext
        );

        // Execute the scenario and record the results
        console.log('Executing and recording scenario...');
        const recordedScenario = await automation.executeAndRecordScenario(scenario);

        // Log the final scenario with all recorded information
        console.log('\nFinal recorded scenario:');
        console.log(JSON.stringify(recordedScenario, null, 2));

    } catch (error) {
        console.error('Error during test automation:', error);
    } finally {
        // Cleanup
        console.log('Cleaning up...');
        await automation.cleanup();
    }
}

// Run the main function
main().catch(console.error); 