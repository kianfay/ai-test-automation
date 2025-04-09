# AI-Driven Test Automation

This project implements AI-driven test automation using Playwright and Google's Gemini AI models. It can automatically generate and execute test scenarios based on product context.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env.example` to `.env`
- Add your Google AI API key (get it from https://makersuite.google.com/app/apikey)
- Set the BASE_URL to your application's URL

3. Install Playwright browsers:
```bash
npx playwright install
```

## Usage

1. Start the test automation:
```bash
npm start
```

2. The system will:
- Analyze your product based on provided context
- Generate test scenarios using Gemini AI
- Convert scenarios to Playwright code
- Execute the tests
- Report results

## How It Works

1. **Product Analysis**: The Gemini AI analyzes your product context and generates relevant test scenarios
2. **Test Generation**: Natural language test steps are converted to Playwright code
3. **Test Execution**: Generated tests are executed in a real browser
4. **Result Analysis**: Test results are analyzed and reported

## Configuration

- Edit `playwright.config.ts` to configure browser settings
- Modify `src/index.ts` to adjust AI behavior
- Update `.env` for environment-specific settings

## Requirements

- Node.js 16+
- Google AI API key
- Playwright-compatible browser 