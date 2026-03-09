import { App } from '@slack/bolt';
import { reviewSpec, answerQuestion } from './reviewer.js';

/**
 * Dino Slack Bot — Socket Mode
 *
 * Runs locally or on a server using WebSocket connection.
 * No public URL needed.
 *
 * Triggers:
 *   - "review:" prefix in #dev-dino → runs spec review
 *   - @Dino Bot mention → answers dev questions
 *   - "approved" reaction → posts to #cursor-tasks
 */

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const CURSOR_TASKS_CHANNEL = process.env.CURSOR_TASKS_CHANNEL ?? '';
const DEV_DINO_CHANNEL = process.env.DEV_DINO_CHANNEL ?? '';

/**
 * Handle "review:" prefix — triggers ChatGPT spec review.
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

  // Acknowledge receipt
  await say({
    text: 'Reviewing spec... This takes 15-30 seconds.',
    thread_ts: message.ts,
  });

  try {
    const review = await reviewSpec(specContent);

    await say({
      text: review,
      thread_ts: message.ts,
    });

    // If approved, notify cursor-tasks channel
    if (review.toUpperCase().includes('APPROVED') && CURSOR_TASKS_CHANNEL) {
      const specPreview = specContent.substring(0, 200).replace(/\n/g, ' ');
      await client.chat.postMessage({
        channel: CURSOR_TASKS_CHANNEL,
        text: `*Spec approved and ready for implementation.*\n\n` +
          `Review thread: <https://dino-workspace-org.slack.com/archives/${('channel_id' in message ? message.channel_id : message.channel)}/p${message.ts.replace('.', '')}>\n\n` +
          `Preview: ${specPreview}...`,
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
 * Handle @Dino Bot mentions — answers dev questions.
 */
app.event('app_mention', async ({ event, say }) => {
  // Strip the bot mention from the text
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
  console.log('Dino Bot is running in Socket Mode');
})();
