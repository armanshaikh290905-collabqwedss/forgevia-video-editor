import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini API client
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// REST API for generating video storyboard scripts from visual prompt descriptions
app.post('/api/generate-script', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt parameter is required.' });
      return;
    }

    const ai = getAiClient();
    const systemInstruction = 
      "You are a professional video director and script writer. " +
      "Given a video theme or idea, write a creative visual sequence with exact timing. " +
      "The total script length should be around 15-30 seconds, divided into 3 to 5 scenes. " +
      "Select a thematic style from ['neon', 'cosmic', 'dreamy', 'ambient'] and suggested soundtrack type from ['lofi', 'techno', 'ambient']. " +
      "Ensure each scene has start time, duration, short screen text overlay, and a matching procedural video asset suggestion.";

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Generate a script and storyboard for: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['title', 'overview', 'theme', 'suggestedMusic', 'scenes'],
          properties: {
            title: { type: Type.STRING, description: 'The title of the generated video.' },
            overview: { type: Type.STRING, description: 'A brief conceptual summary of the video idea.' },
            theme: { 
              type: Type.STRING, 
              enum: ['neon', 'cosmic', 'dreamy', 'ambient'], 
              description: 'The overall visual theme matching the procedural rendering types.' 
            },
            suggestedMusic: { 
              type: Type.STRING, 
              enum: ['lofi', 'techno', 'ambient'], 
              description: 'The type of procedural soundtrack to load.' 
            },
            scenes: {
              type: Type.ARRAY,
              description: 'The scene-by-scene timing and overlays.',
              items: {
                type: Type.OBJECT,
                required: ['id', 'title', 'timeStart', 'duration', 'description', 'overlayText', 'suggestedAssetType'],
                properties: {
                  id: { type: Type.STRING, description: 'Unique scene ID.' },
                  title: { type: Type.STRING, description: 'Title of this scene segment.' },
                  timeStart: { type: Type.NUMBER, description: 'Start time in seconds on the timeline.' },
                  duration: { type: Type.NUMBER, description: 'Duration of the scene in seconds.' },
                  description: { type: Type.STRING, description: 'Visual action description.' },
                  overlayText: { type: Type.STRING, description: 'The text overlay / subtitle to overlay onto the screen.' },
                  suggestedAssetType: { 
                    type: Type.STRING, 
                    enum: ['grid', 'stars', 'plasma', 'gradient', 'waves', 'matrix'], 
                    description: 'The exact matching procedural graphic to render.' 
                  }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini model did not return any output text.');
    }

    const scriptData = JSON.parse(text.trim());
    res.json({ success: true, data: scriptData });

  } catch (error: any) {
    console.error('Gemini generate script error:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred while generating script content from Gemini API.' 
    });
  }
});

// App Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Setup Vite Development Middleware or Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
