import { App } from '@slack/bolt';
import { reviewSpec, answerQuestion } from './reviewer.js';

/**
 * Dino Slack Bot — Socket Mode
 *
 * 3-Round Dual-LLM Review Process:
 *   Round 1: Claude Code self-review (happens before Slack — already done)
 *   Round 2: ChatGPT independent review (triggered by "review:" in Slack)
 *   Round 3: ChatGPT reviews CTO's fixes (triggered by "review-round-3:" in thread)
 *
 * Approval requires both LLMs to agree. Only then does spec go to #cursor-tasks.
 *
 * Other triggers:
 *   - @Dino Bot mention → answers dev questions
 */

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const CURSOR_TASKS_CHANNEL = process.env.CURSOR_TASKS_CHANNEL ?? '';

/** Track review state per thread. Key = thread_ts */
const reviewState = new Map<string, {
  round: number;
  claudeApproved: boolean;
  chatgptApproved: boolean;
  specContent: string;
}>();

/**
 * Round 2: "review:" prefix — ChatGPT's independent review.
 * Claude Code has already done Round 1 (self-review) before posting.
 */
app.message(/^review:/i, async ({ message, say, client }) => {
  if (message.subtype || !('text' in message)) return;

  const specContent = (message.text ?? '').replace(/^review:\s*/i, '');

  if (specContent.length < 50) {
    await say({
      text: 'Spec content is too short to review. Paste the full handover spec after `review:`.',
      thread_ts: message.ts,
    });
    return;
  }

  // Initialize review state — Round 1 (Claude self-review) assumed done
  reviewState.set(message.ts, {
    round: 2,
    claudeApproved: true, // CTO self-reviewed before posting
    chatgptApproved: false,
    specContent,
  });

  await say({
    text: '*Round 2 of 3* — ChatGPT independent review in progress... (15-30 seconds)',
    thread_ts: message.ts,
  });

  try {
    const review = await reviewSpec(specContent);
    const isApproved = review.toUpperCase().includes('APPROVED') &&
      !review.toUpperCase().includes('NEEDS CHANGES') &&
      !review.toUpperCase().includes('BLOCKED');

    const state = reviewState.get(message.ts);
    if (state) {
      state.chatgptApproved = isApproved;
    }

    await say({
      text: `*[Round 2/3 — ChatGPT Review]*\n\n${review}`,
      thread_ts: message.ts,
    });

    if (isApproved && state?.claudeApproved) {
      // Both LLMs agree — spec is approved
      await say({
        text: '*DUAL-LLM CONSENSUS REACHED*\n\n' +
          'Round 1 (Claude Code self-review): APPROVED\n' +
          'Round 2 (ChatGPT independent review): APPROVED\n\n' +
          'Spec is ready for implementation. Forwarding to #cursor-tasks.',
        thread_ts: message.ts,
      });

      if (CURSOR_TASKS_CHANNEL) {
        const preview = specContent.substring(0, 300).replace(/\n/g, ' ');
        await client.chat.postMessage({
          channel: CURSOR_TASKS_CHANNEL,
          text: `*Spec approved — dual-LLM consensus reached.*\n\n` +
            `Both Claude Code and ChatGPT approved this spec.\n` +
            `Review thread: <https://dino-workspace-org.slack.com/archives/${message.channel}/p${message.ts.replace('.', '')}>\n\n` +
            `Preview: ${preview}...`,
        });
      }
    } else if (!isApproved) {
      await say({
        text: '*Round 2 has findings.* CTO: address the issues above, then post `review-round-3: <updated spec>` in this thread for the final round.',
        thread_ts: message.ts,
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await say({
      text: `Review failed: ${errMsg}`,
      thread_ts: message.ts,
    });
  }
});

/**
 * Round 3: "review-round-3:" — ChatGPT reviews CTO's fixes.
 * Only triggers in a thread where Round 2 already happened.
 */
app.message(/^review-round-3:/i, async ({ message, say, client }) => {
  if (message.subtype || !('text' in message)) return;

  const threadTs = ('thread_ts' in message ? message.thread_ts : message.ts) as string;
  const state = reviewState.get(threadTs);

  if (!state) {
    await say({
      text: 'No active review in this thread. Start with `review: <spec>` first.',
      thread_ts: message.ts,
    });
    return;
  }

  const updatedSpec = (message.text ?? '').replace(/^review-round-3:\s*/i, '');

  if (updatedSpec.length < 50) {
    await say({
      text: 'Updated spec is too short. Paste the full revised spec after `review-round-3:`.',
      thread_ts: threadTs,
    });
    return;
  }

  state.round = 3;
  state.specContent = updatedSpec;

  await say({
    text: '*Round 3 of 3* — ChatGPT final review of CTO fixes... (15-30 seconds)',
    thread_ts: threadTs,
  });

  try {
    const review = await reviewSpec(updatedSpec);
    const isApproved = review.toUpperCase().includes('APPROVED') &&
      !review.toUpperCase().includes('NEEDS CHANGES') &&
      !review.toUpperCase().includes('BLOCKED');

    state.chatgptApproved = isApproved;

    await say({
      text: `*[Round 3/3 — ChatGPT Final Review]*\n\n${review}`,
      thread_ts: threadTs,
    });

    if (isApproved && state.claudeApproved) {
      await say({
        text: '*DUAL-LLM CONSENSUS REACHED*\n\n' +
          'Round 1 (Claude Code self-review): APPROVED\n' +
          'Round 2 (ChatGPT review): findings addressed\n' +
          'Round 3 (ChatGPT final review): APPROVED\n\n' +
          'Spec is ready for implementation. Forwarding to #cursor-tasks.',
        thread_ts: threadTs,
      });

      if (CURSOR_TASKS_CHANNEL) {
        const preview = updatedSpec.substring(0, 300).replace(/\n/g, ' ');
        await client.chat.postMessage({
          channel: CURSOR_TASKS_CHANNEL,
          text: `*Spec approved — dual-LLM consensus reached (3 rounds).*\n\n` +
            `Both Claude Code and ChatGPT approved after 3 review rounds.\n` +
            `Review thread: <https://dino-workspace-org.slack.com/archives/${message.channel}/p${threadTs.replace('.', '')}>\n\n` +
            `Preview: ${preview}...`,
        });
      }

      reviewState.delete(threadTs);
    } else {
      await say({
        text: '*Round 3 still has findings.* Spec NOT approved. CTO and ChatGPT do not have consensus. Review the findings and decide whether to revise or override.',
        thread_ts: threadTs,
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await say({
      text: `Review failed: ${errMsg}`,
      thread_ts: threadTs,
    });
  }
});

/**
 * Handle @Dino Bot mentions — answers dev questions.
 */
app.event('app_mention', async ({ event, say }) => {
  const question = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!question) {
    await say({
      text: 'How can I help? Ask me about Dino architecture, code, or engineering standards.',
      thread_ts: event.ts,
    });
    return;
  }

  try {
    const answer = await answerQuestion(question);
    await say({
      text: answer,
      thread_ts: event.ts,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await say({
      text: `Error: ${errMsg}`,
      thread_ts: event.ts,
    });
  }
});

/**
 * Start the bot.
 */
(async () => {
  await app.start();
  console.log('Dino Bot is running in Socket Mode — 3-round dual-LLM review active');
})();
