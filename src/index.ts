import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Polyfill global fetch
global.fetch = fetch as any;

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

interface TestScenario {
  name: string;
  steps: string[];
  expectedResults: string[];
}

class AITestAutomation {
  private browser: any;
  private page: any;
  private context: any;
  private model: any;

  async initialize() {
    this.browser = await chromium.launch();
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  async analyzeProduct(url: string, productContext: string) {
    const prompt = `You are a test automation expert. Analyze the following product context and generate test scenarios.
    IMPORTANT: Your response must be a valid JSON object with the exact structure shown below. Do not include any markdown formatting, backticks, or additional text.
    
    Product Context:
    ${productContext}
    
    URL: ${url}
    
    Required JSON structure:
    {
      "scenarios": [
        {
          "name": "scenario name",
          "steps": ["step1", "step2"],
          "expectedResults": ["result1", "result2"]
        }
      ]
    }`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      console.log('Raw response:', text);
      
      // Clean the response text to ensure it's valid JSON
      const cleanedText = text
        .replace(/```json\n?/g, '')  // Remove markdown code blocks
        .replace(/```\n?/g, '')      // Remove any remaining backticks
        .trim();                     // Remove whitespace
      
      console.log('Cleaned response:', cleanedText);
      
      const parsed = JSON.parse(cleanedText);
      return parsed.scenarios;
    } catch (error) {
      console.error('Error parsing response:', error);
      throw error;
    }
  }

  async generateAndRunTests(scenarios: TestScenario[]) {
    for (const scenario of scenarios) {
      console.log(`Running scenario: ${scenario.name}`);
      
      for (const step of scenario.steps) {
        const playwrightCode = await this.generatePlaywrightCode(step);
        await this.executePlaywrightCode(playwrightCode);
      }
    }
  }

  private async generatePlaywrightCode(step: string): Promise<string> {
    const prompt = `Convert the following test step into Playwright code. Return only the code, no explanations:
    Step: ${step}`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private async executePlaywrightCode(code: string) {
    // Execute the generated Playwright code
    console.log('Executing Playwright code:', code);
    //////////////////////////////////////////////////////////////////////////////////////////////// eval(code);
  }

  async cleanup() {
    await this.browser.close();
  }
}

export default AITestAutomation; 