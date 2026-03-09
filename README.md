# Dino Slack Bot

ChatGPT-powered spec reviewer for the Dino engineering team. Lives in `#dev-dino` on Slack.

## What It Does

- **Spec review**: Post `review: <spec content>` in `#dev-dino` — ChatGPT reviews against Dino's engineering standards
- **Dev questions**: `@Dino Bot <question>` — answers architecture, code, and workflow questions
- **Auto-forward**: Approved specs are automatically posted to `#cursor-tasks` for implementation

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `SLACK_BOT_TOKEN` — Bot User OAuth Token (`xoxb-...`)
   - `SLACK_APP_TOKEN` — App-Level Token (`xapp-...`) for Socket Mode
   - `OPENAI_API_KEY` — OpenAI API key

2. Enable Socket Mode in your Slack app settings

3. Subscribe to events: `app_mention`, `message.channels`

4. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

## Review Protocol

The bot enforces Dino's engineering standards:
- 22 hard constraints (HC #13, #18-#22)
- SonarCloud-clean code requirements
- Test category requirements (unit, integration, failure-mode, false-output, regression)
- One-round review — findings are BLOCKING or SUGGESTION

## Architecture

```
Slack message → @slack/bolt (Socket Mode) → OpenAI API → Slack thread reply
```

Three files:
- `src/system-prompt.ts` — Dino review rules and standards
- `src/reviewer.ts` — OpenAI API wrapper
- `src/socket-mode.ts` — Slack Bolt app with event handlers
