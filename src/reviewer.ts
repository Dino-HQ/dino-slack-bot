import OpenAI from 'openai';
import { REVIEW_SYSTEM_PROMPT, DEV_ASSISTANT_PROMPT } from './system-prompt.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o';

/**
 * Review a handover spec using ChatGPT.
 * Returns the review text.
 */
export async function reviewSpec(specContent: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Please review the following handover spec:\n\n${specContent}`,
      },
    ],
    max_tokens: 2000,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? 'Review failed — no response from model.';
}

/**
 * Answer a general dev question using ChatGPT.
 */
export async function answerQuestion(question: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: DEV_ASSISTANT_PROMPT },
      { role: 'user', content: question },
    ],
    max_tokens: 1000,
    temperature: 0.5,
  });

  return response.choices[0]?.message?.content ?? 'No response from model.';
}
