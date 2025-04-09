import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Polyfill global fetch
global.fetch = fetch as any;

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

interface TestScenario {
  name: string;
  steps: {
    description: string;
    selector?: string;
    action?: string;
    expectedResult?: string;
    verified?: boolean;
  }[];
  expectedResults: string[];
}

interface AILogEntry {
  timestamp: string;
  scenarioName: string;
  stepDescription: string;
  stepNumber: number;
  response: string;
  type: 'analysis' | 'verification';
  prompt?: string;
}

class AITestAutomation {
  private browser: any;
  private page: any;
  private context: any;
  private model: any;
  private logEntries: AILogEntry[] = [];

  async initialize() {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Set shorter timeouts for all operations
    this.page.setDefaultTimeout(5000); // 5 seconds instead of 30
    this.page.setDefaultNavigationTimeout(5000);
  }

  private logAIResponse(scenarioName: string, stepDescription: string, stepNumber: number, response: string, type: 'analysis' | 'verification', prompt?: string) {
    const logEntry: AILogEntry = {
      timestamp: new Date().toISOString(),
      scenarioName,
      stepDescription,
      stepNumber,
      response,
      type,
      prompt
    };
    this.logEntries.push(logEntry);
  }

  private async saveLogs() {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    const logPath = path.join(logDir, `ai_response_log_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify(this.logEntries, null, 2));
    console.log(`AI responses logged to: ${logPath}`);
  }

  private async debugLog(message: string) {
    const debugDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir);
    }

    const debugPath = path.join(debugDir, 'debug_for_ai.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    fs.appendFileSync(debugPath, logMessage);
  }

  async analyzeProduct(url: string, productContext: string) {
    const prompt = `You are a test automation expert. Analyze the following product context and generate a single test scenario.
    IMPORTANT: Your response must be a valid JSON object with the exact structure shown below. Do not include any markdown formatting, backticks, or additional text.
    
    Product Context:
    ${productContext}
    
    URL: ${url}
    
    Required JSON structure:
    {
      "scenarios": [
        {
          "name": "scenario name",
          "steps": [
            {
              "description": "step description"
            }
          ],
          "expectedResults": ["result1", "result2"]
        }
      ]
    }`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean the response text to ensure it's valid JSON
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const parsed = JSON.parse(cleanedText);
      return parsed.scenarios[0];
    } catch (error) {
      console.error('Error parsing response:', error);
      throw error;
    }
  }

  async executeAndRecordScenario(scenario: TestScenario) {
    console.log(`Executing scenario: ${scenario.name}`);
    
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      console.log(`\nExecuting step: ${step.description}`);
      
      let retryCount = 0;
      const maxRetries = 3;
      let stepCompleted = false;
      let lastVerification = null;

      while (!stepCompleted && retryCount < maxRetries) {
        // Get the current DOM state
        const domState = await this.page.content();
        
        // Ask AI to analyze the DOM and suggest a selector and action
        const analysisPrompt = retryCount === 0 
          ? `Given this DOM state and the step description, suggest a Playwright selector and action in JavaScript.
            DOM State: ${domState}
            Step Description: ${step.description}
            Expected Result: ${scenario.expectedResults[i]}
            
            Return a JSON object with this structure:
            {
              "selector": "the suggested selector",
              "action": "the suggested Playwright action in JavaScript (use \\n for newlines)",
              "explanation": "why this selector and action were chosen"
            }`
          : `Previous attempt failed. Here's what happened:
            Previous Selector: ${step.selector}
            Previous Action: ${step.action}
            Failure Explanation: ${lastVerification?.explanation || 'No explanation available'}
            Current DOM State: ${domState}
            Step Description: ${step.description}
            Expected Result: ${scenario.expectedResults[i]}
            
            Please suggest a different approach. Return a JSON object with this structure:
            {
              "selector": "the suggested selector",
              "action": "the suggested Playwright action in JavaScript (use \\n for newlines)",
              "explanation": "why this new approach should work better"
            }`;

        const analysisResult = await this.model.generateContent(analysisPrompt);
        const analysisResponse = await analysisResult.response;
        const analysisText = analysisResponse.text();
        
        // Log the AI response
        this.logAIResponse(scenario.name, step.description, i + 1, analysisText, 'analysis', analysisPrompt);
        
        // Clean and parse the JSON response
        let analysis;
        try {
          // Remove all markdown code block markers and backticks
          const cleanedText = analysisText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/`/g, '')
            .trim();
          
          analysis = JSON.parse(cleanedText);
        } catch (error) {
          console.error('Error parsing AI response:', error);
          console.error('Response text:', analysisText);
          throw error;
        }
        
        // Update the step with the suggested selector and action
        step.selector = analysis.selector;
        step.action = analysis.action;
        
        // Show the command to be executed
        console.log('\nCommand to be executed:');
        console.log(analysis.action);
        console.log('\nPress Enter to execute this command, or Ctrl+C to abort...');
        
        // Wait for user input
        await new Promise(resolve => {
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          readline.question('', () => {
            readline.close();
            resolve(null);
          });
        });
        
        // Execute the action
        try {
          // Parse the action to determine which Playwright method to call
          const action = analysis.action.trim();
          
          // Split multiple actions into individual lines
          const actions = action.split('\n').map((a: string) => a.trim()).filter((a: string) => a);
          
          for (const singleAction of actions) {
            if (singleAction.startsWith('await page.goto')) {
              const url = singleAction.match(/goto\('([^']+)'\)/)?.[1];
              if (url) {
                await this.page.goto(url);
                // Wait for the page to load completely
                await this.page.waitForLoadState('networkidle');
              }
            } else if (singleAction.startsWith('await page.fill')) {
              const match = singleAction.match(/fill\('([^']+)',\s*'([^']+)'\)/);
              if (!match) {
                await this.debugLog(`Failed to parse fill action: ${singleAction}`);
                continue;
              }
              const selector = match[1];
              const value = match[2];
              await this.debugLog(`Parsed fill action - selector: ${selector}, value: ${value}`);
              
              if (selector && value) {
                try {
                  // Wait for the element to be visible before filling
                  await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
                  await this.page.fill(selector, value);
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  await this.debugLog(`Error filling input: ${errorMessage}`);
                  throw error;
                }
              }
            } else if (singleAction.startsWith('await page.locator')) {
              const match = singleAction.match(/locator\('([^']+)'\)\.fill\('([^']+)'\)/);
              if (!match) {
                await this.debugLog(`Failed to parse locator action: ${singleAction}`);
                continue;
              }
              const selector = match[1];
              const value = match[2];
              await this.debugLog(`Parsed locator action - selector: ${selector}, value: ${value}`);
              
              if (selector && value) {
                try {
                  // Wait for the element to be visible before filling
                  await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
                  await this.page.fill(selector, value);
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  await this.debugLog(`Error filling input: ${errorMessage}`);
                  throw error;
                }
              }
            } else if (singleAction.startsWith('await page.click')) {
              const selector = singleAction.match(/click\('([^']+)'\)/)?.[1];
              if (selector) {
                // Wait for the element to be clickable
                await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
                await this.page.click(selector);
              }
            } else if (singleAction.startsWith('await page.waitForNavigation')) {
              await this.page.waitForNavigation({ timeout: 5000 });
            } else if (singleAction.startsWith('await page.waitForTimeout')) {
              const timeout = parseInt(singleAction.match(/waitForTimeout\((\d+)\)/)?.[1] || '0');
              if (timeout > 0) {
                await this.page.waitForTimeout(timeout);
              }
            } else if (singleAction.startsWith('console.')) {
              // Handle console statements
              console.log(singleAction.replace(/^console\.(log|error|warn)\('(.*)'\);?$/, '$2'));
            } else {
              // For other actions, try to evaluate them in the page context
              await this.page.evaluate(`async () => { ${singleAction} }`);
            }
          }
          
          // Verify the result
          const verificationPrompt = step.description.toLowerCase().includes('navigate') || step.description.toLowerCase().includes('open')
            ? `Given this DOM state after the action, verify if the navigation was successful by checking if we reached the login page.
              DOM State: ${await this.page.content()}
              
              Return a JSON object with this structure:
              {
                "verified": true/false,
                "explanation": "why the navigation was or wasn't successful. For login page navigation, success means seeing the login form with email and password fields."
              }`
            : `Given this DOM state after the action, verify if the expected result was achieved.
              DOM State: ${await this.page.content()}
              Expected Result: ${scenario.expectedResults[i]}
              
              Return a JSON object with this structure:
              {
                "verified": true/false,
                "explanation": "why the result was or wasn't achieved"
              }`;

          await this.debugLog('\nDebug - Verification prompt: ' + verificationPrompt);
          const verificationResult = await this.model.generateContent(verificationPrompt);
          const verificationResponse = await verificationResult.response;
          const verificationText = verificationResponse.text();
          await this.debugLog('Debug - Verification response: ' + verificationText);
          
          // Log the verification response
          this.logAIResponse(scenario.name, `${step.description}_verification`, i + 1, verificationText, 'verification', verificationPrompt);
          
          // Clean and parse the verification response
          let verification;
          try {
            // Remove all markdown code block markers and backticks
            const cleanedText = verificationText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .replace(/`/g, '')
              .trim();
            
            verification = JSON.parse(cleanedText);
            await this.debugLog('Debug - Parsed verification: ' + JSON.stringify(verification));
          } catch (error) {
            console.error('Error parsing verification response:', error);
            console.error('Response text:', verificationText);
            throw error;
          }
          
          lastVerification = verification;
          
          // For navigation steps, we should verify that we're on the login page
          if (step.description.toLowerCase().includes('navigate') || step.description.toLowerCase().includes('open')) {
            const domContent = await this.page.content();
            const isLoginPage = domContent.includes('name="email"') && 
                              domContent.includes('name="password"');
            step.verified = isLoginPage;
            console.log(`Step ${i + 1} ${isLoginPage ? 'passed' : 'failed'}: ${isLoginPage ? 'Successfully navigated to login page' : 'Failed to navigate to login page'}`);
          } else {
            step.verified = verification.verified;
            console.log(`Step ${i + 1} ${verification.verified ? 'passed' : 'failed'}: ${verification.explanation}`);
          }
          
          stepCompleted = true;
        } catch (error) {
          console.error(`Error executing step ${i + 1}:`, error);
          step.verified = false;
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`\nRetrying step (attempt ${retryCount + 1}/${maxRetries})...`);
          }
        }
      }

      if (!stepCompleted) {
        console.log(`\nFailed to complete step after ${maxRetries} attempts. Moving to next step.`);
      }
    }
    
    // Save all logs before returning
    await this.saveLogs();
    return scenario;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

export default AITestAutomation; 