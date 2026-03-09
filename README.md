# Dino Slack Bot

ChatGPT-powered spec reviewer for the Dino engineering team. Lives in `#dev-dino` on Slack.

## What It Does

### 3-Round Dual-LLM Spec Review

Two LLMs review every spec to prevent tunnel vision from a single model:

| Round | Reviewer | Trigger |
| --- | --- | --- |
| 1 | Claude Code (CTO) | Self-review before posting to Slack |
| 2 | ChatGPT | `review: <spec>` in `#dev-dino` |
| 3 | ChatGPT | `review-round-3: <updated spec>` in thread (if Round 2 had findings) |

**Approval requires dual-LLM consensus** — both Claude Code AND ChatGPT must agree. Approved specs are auto-forwarded to `#cursor-tasks` for implementation.

### Other Features

- **Dev questions**: `@Dino Bot <question>` — answers architecture, code, and workflow questions

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
- 3-round dual-LLM consensus (Claude Code + ChatGPT)
- Findings are BLOCKING or SUGGESTION

## Architecture

```
Slack message → @slack/bolt (Socket Mode) → OpenAI API → Slack thread reply
```

Three files:
- `src/system-prompt.ts` — Dino review rules and standards
- `src/reviewer.ts` — OpenAI API wrapper
- `src/socket-mode.ts` — Slack Bolt app with event handlers
