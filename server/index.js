import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

app.post('/api/npc-chat', async (req, res) => {
  try {
    const { question, history = [], context = {} } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ answer: 'Ask me a real question.' });
    }

    const response = await client.responses.create({
      model: 'gpt-5',
      instructions: `
You are the OverBound Guide, an NPC inside the game OverBound.
Answer as a helpful in-game guide.
Keep answers short: 1-3 sentences.
Only answer about the game: controls, portals, enemies, health, gold, trading, objectives, and navigation.
If asked about unrelated topics, politely steer back to OverBound.
Game context:
${JSON.stringify(context)}
`,
      input: [
        ...history.map((message) => ({
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

    res.json({
      answer: response.output_text || 'I am not sure yet. Try asking about controls or portals.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      answer: 'The guide service is unavailable right now.',
    });
  }
});

app.listen(3000, () => {
  console.log('NPC AI backend running on http://localhost:3000');
});