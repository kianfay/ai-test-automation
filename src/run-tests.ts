import AITestAutomation from './index';

async function main() {
    const automation = new AITestAutomation();
    
    try {
        // Initialize the automation system
        console.log('Initializing test automation...');
        await automation.initialize();

        // Define your product context
        const productContext = `
            Cindi.ai is an AI-powered platform that helps users manage and automate their workflows.
            
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
        `;

        // Analyze the product and generate test scenarios
        console.log('Analyzing product and generating test scenarios...');
        const scenarios = await automation.analyzeProduct(
            process.env.BASE_URL || 'https://app.cindi.ai/auth/login',
            productContext
        );

        // Run the generated tests
        console.log('Running generated tests...');
        await automation.generateAndRunTests(scenarios);

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