import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import OpenAI from 'openai';

const openAiApiKey = defineSecret('OPENAI_API_KEY');
const app = express();

app.use(express.json({ limit: '24kb' }));

function getNpcInstructions(context) {
  return `
You are the OverBound Guide, an NPC inside the game OverBound.
Answer as a helpful in-game guide.
Keep answers short: 1-3 sentences.
Only answer about the game: controls, portals, enemies, health, gold, trading, objectives, and navigation.
If asked about unrelated topics, politely steer back to OverBound.
Game context:
${JSON.stringify(context)}
`;
}

app.post('/api/npc-chat', async (req, res) => {
  try {
    const { question, history = [], context = {} } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ answer: 'Ask me a real question.' });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
    const client = new OpenAI({
      apiKey: openAiApiKey.value(),
    });

    const response = await client.responses.create({
      model: 'gpt-5',
      instructions: getNpcInstructions(context),
      input: [
        ...safeHistory
          .filter((message) => message && typeof message.text === 'string')
          .map((message) => ({
            role: message.from === 'player' ? 'user' : 'assistant',
            content: message.text,
          })),
        {
          role: 'user',
          content: question,
        },
      ],
      max_output_tokens: 160,
    });

    return res.json({
      answer: response.output_text || 'I am not sure yet. Try asking about controls or portals.',
    });
  } catch (error) {
    console.error('NPC chat failed:', error);
    return res.status(500).json({
      answer: 'The guide service is unavailable right now.',
    });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ answer: 'Unknown API route.' });
});

export const api = onRequest(
  {
    secrets: [openAiApiKey],
    region: 'us-central1',
    cors: false,
  },
  app
);
